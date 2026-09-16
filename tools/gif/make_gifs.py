#!/usr/bin/env python3
"""Render the animated figures as GIFs for slides.

One headless screenshot per figure captures a grid of frames drawn by
tools/gif/capture.html, which those frames are then sliced from. The figures are
the site's own modules, so a GIF always matches what the website shows.

    python tools/gif/make_gifs.py            both figures
    python tools/gif/make_gifs.py hero       just the landscape and FRET trace
    python tools/gif/make_gifs.py zmw        just the waveguide

Output goes to G:\\My Drive\\Anu\\Satya\\WebSite_github\\_presentation.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops

SITE = r"D:\Projects\website"
OUT = r"G:\My Drive\Anu\Satya\WebSite_github\_presentation"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# frames = COLS * ROWS, sampled every MS milliseconds of page time
JOBS = {
    "hero": dict(cols=6, rows=8, fw=600, ms=120, sw=None, extra="&kT=0.68&every=1",
                 name="hero-transition-path.gif",
                 note="protein crossing its barrier, with the photon traces below"),
    # the aperture is a narrow column in a wide canvas, so the frame is cropped
    # to it: otherwise the evanescent layer is a sliver nobody can see on a slide
    "zmw": dict(cols=6, rows=8, fw=600, ms=120, sw=455, extra="&d=120&sx=135&sw=455&every=1",
                name="zmw-120nm.gif",
                note="enzymes diffusing through a 120 nm aperture, zoomed on the hole"),
}


def capture(fig, cfg, shot):
    cols, rows, fw, ms = cfg["cols"], cfg["rows"], cfg["fw"], cfg["ms"]
    src_h = 540 if fig == "hero" else 340
    src_w = 720 if fig == "hero" else 820
    fh = round(fw * src_h / (cfg.get("sw") or src_w))
    url = ("file:///" + SITE.replace("\\", "/") + "/tools/gif/capture.html"
           + "?fig=%s&cols=%d&rows=%d&fw=%d&ms=%d%s" % (fig, cols, rows, fw, ms, cfg["extra"]))
    # budget must comfortably exceed frames * ms of page time
    # Generous: each captured frame costs several animation frames of virtual
    # time, and fonts and layout spend some of it before capture even starts.
    budget = cols * rows * 500 + 60000
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--window-size=%d,%d" % (cols * fw, rows * fh),
           "--force-device-scale-factor=1",
           "--virtual-time-budget=%d" % budget,
           "--screenshot=" + shot, url]
    subprocess.run(cmd, capture_output=True, timeout=300)
    if not os.path.exists(shot):
        raise SystemExit("no screenshot written for " + fig)
    return cols, rows, fw, fh


def slice_to_gif(shot, cols, rows, fw, fh, out_path, ms):
    sheet = Image.open(shot).convert("RGB")
    frames = []
    for i in range(cols * rows):
        x, y = (i % cols) * fw, (i // cols) * fh
        frames.append(sheet.crop((x, y, x + fw, y + fh)))
    # drop trailing frames that never got drawn (blank white)
    while len(frames) > 2:
        px = frames[-1].getcolors(maxcolors=1)
        if px and px[0][1] == (255, 255, 255):
            frames.pop()
        else:
            break
    # Each frame keeps its own adaptive palette. Forcing them onto one shared
    # palette flattens the motion, since 128 colours chosen from the first frame
    # cannot hold faint grey molecules moving over white, and frames then
    # quantise into one another and get merged away on save.
    # optimize=True was the other half of the problem: it merges frames whose
    # delta it considers empty and sums their durations.
    uniq = [frames[0]]
    for f in frames[1:]:
        if ImageChops.difference(f, uniq[-1]).getbbox() is not None:
            uniq.append(f)
    if len(uniq) != len(frames):
        print("   dropped %d duplicate frames" % (len(frames) - len(uniq)))
    frames = uniq
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=255) for f in frames]
    pal[0].save(out_path, save_all=True, append_images=pal[1:],
                duration=ms, loop=0, optimize=False, disposal=1)
    check = Image.open(out_path)
    kept = getattr(check, "n_frames", 1)
    if kept != len(frames):
        print("   WARNING: wrote %d frames but the file holds %d" % (len(frames), kept))
    return kept


def frames_of(path):
    im = Image.open(path)
    out = []
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        out.append(im.convert("RGB").copy())
    return out


def walker_span(frames):
    """How far the darkest blob travels across the landscape panel, 0 to 1.

    The walk is stochastic, so a capture can catch the protein sitting in one
    well for the whole window. A GIF for a talk has to contain a crossing, so
    the run is judged and repeated until it does.
    """
    xs = []
    for f in frames:
        g = f.crop((40, 40, f.width - 20, 300)).convert("L")
        w, h = g.size
        px = g.load()
        best = None
        for x in range(0, w, 4):
            col = sum(px[x, y] for y in range(0, h, 4))
            if best is None or col < best[1]:
                best = (x, col)
        xs.append(best[0] / w)
    return (max(xs) - min(xs)) if xs else 0.0


def main():
    which = sys.argv[1:] or list(JOBS)
    os.makedirs(OUT, exist_ok=True)
    for fig in which:
        cfg = JOBS[fig]
        final = os.path.join(OUT, cfg["name"])
        cand = os.path.join(tempfile.gettempdir(), "cand_%s.gif" % fig)
        shot = os.path.join(tempfile.gettempdir(), "capture_%s.png" % fig)
        best = None
        for attempt in range(1, 9):
            if os.path.exists(shot):
                os.remove(shot)
            cols, rows, fw, fh = capture(fig, cfg, shot)
            slice_to_gif(shot, cols, rows, fw, fh, cand, cfg["ms"])
            fr = frames_of(cand)
            span = walker_span(fr) if fig == "hero" else 1.0
            ok = len(fr) >= 12 and span >= (0.35 if fig == "hero" else 0.0)
            score = len(fr) + span * 100
            print("   attempt %d: %2d frames, crossing span %.2f%s"
                  % (attempt, len(fr), span, "  accepted" if ok else ""))
            if best is None or score > best:
                best = score
                shutil.copyfile(cand, final)
            if ok:
                break
        n = len(frames_of(final))
        kb = os.path.getsize(final) / 1024
        print("%-5s %2d frames  %6.0f KB  %s" % (fig, n, kb, final))
        print("      %s" % cfg["note"])


if __name__ == "__main__":
    main()
