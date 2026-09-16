#!/usr/bin/env python3
"""Render the animated figures as GIFs for slides.

One headless screenshot per figure captures a grid of frames drawn by
tools/gif/capture.html, which those frames are then sliced from. The figures are
the site's own modules, driven synchronously through a small hook, so a GIF
always matches what the website shows and the frame count is exact.

    python tools/gif/make_gifs.py            both figures
    python tools/gif/make_gifs.py hero       the landscape and FRET trace
    python tools/gif/make_gifs.py zmw        the waveguide with its photon trace

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
DSF = 2   # render at double density, then draw down: crisp lines and text

# The stage sizes here must match capture.html.
JOBS = {
    # time runs two ticks per frame so several crossings fit in one loop, and
    # each completed crossing is then held so it can be watched
    "hero": dict(cols=6, rows=10, fw=1000, src=(1000, 650), ms=90, hold=320,
                 extra="&kT=0.70&every=2&fscale=1.3", min_cross=3, attempts=8,
                 name="hero-transition-path.gif",
                 note="protein crossing its barrier repeatedly, photon traces below"),
    # the hole holds one molecule at a time, so visits are rare and short; a
    # longer loop and faster diffusion make several fit, and each take is
    # judged by counting the bursts in its final trace
    "zmw": dict(cols=6, rows=15, fw=1000, src=(700, 550), ms=120, hold=0,
                extra="&d=120&c=1.0&speed=2.0&every=2&fscale=1.5", min_bursts=3, attempts=6,
                name="zmw-120nm.gif",
                note="enzymes diffusing through a 120 nm aperture at 10 nM, with photon bursts"),
}


def capture(fig, cfg, shot, dsf):
    cols, rows, fw = cfg["cols"], cfg["rows"], cfg["fw"]
    src_w, src_h = cfg["src"]
    fh = round(fw * src_h / src_w)
    url = ("file:///" + SITE.replace("\\", "/") + "/tools/gif/capture.html"
           + "?fig=%s&cols=%d&rows=%d&fw=%d%s" % (fig, cols, rows, fw, cfg["extra"]))
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--window-size=%d,%d" % (cols * fw // dsf, rows * fh // dsf),
           "--force-device-scale-factor=%d" % dsf,
           "--virtual-time-budget=20000",
           "--screenshot=" + shot, url]
    subprocess.run(cmd, capture_output=True, timeout=600)
    return cols, rows, fw, fh


def frames_of(path):
    im = Image.open(path)
    out = []
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        out.append(im.convert("RGB").copy())
    return out


def walker_xs(frames):
    """Horizontal position of the protein in the landscape panel, 0 to 1.

    Tracks colour, not darkness: the walker carries vivid green and red dyes,
    while everything else in the panel is neutral or pale. The darkest column
    would be the black wall of the potential, which never moves.
    """
    xs = []
    for f in frames:
        c = f.crop((40, 20, f.width - 20, int(f.height * 0.56)))
        w, h = c.size
        px = c.load()
        best = (0, -1)
        for x in range(0, w, 3):
            tot = 0
            for y in range(0, h, 3):
                r, g, b = px[x, y]
                sat = max(r, g, b) - min(r, g, b)
                if sat > 70:
                    tot += sat
            if tot > best[1]:
                best = (x, tot)
        xs.append(best[0] / w)
    return xs


def crossing_segments(xs):
    """(start, end) frame ranges of completed crossings: from the last frame in
    one well to the first frame in the other."""
    segs = []
    last_well, last_i = None, None
    for i, x in enumerate(xs):
        s = "L" if x < 0.35 else ("R" if x > 0.65 else None)
        if s is None:
            continue
        if last_well and s != last_well:
            segs.append((last_i, i))
        last_well, last_i = s, i
    return segs


def count_crossings(xs):
    """Well-to-well crossings: the walker must reach the far side, not just the barrier."""
    state, n = None, 0
    for x in xs:
        s = "L" if x < 0.35 else ("R" if x > 0.65 else None)
        if s and state and s != state:
            n += 1
        if s:
            state = s
    return n


def count_bursts(frame, src):
    """Bursts visible in the photon trace of one frame: runs of columns where the
    donor fill rises clearly above the baseline. Geometry follows capture.html
    (a 380 px cross-section over a 170 px trace, drawn at width 700)."""
    fw, fh = frame.size
    src_w, src_h = src
    k = fh / src_h
    trace_top = 380 * k
    y0 = int(trace_top + (8 + 133 / 2) * k)
    hh = int(133 / 2 * k)
    x0, x1 = int(51 * fw / src_w), int(688 * fw / src_w)
    px = frame.load()
    heights = []
    for x in range(x0, x1):
        top = None
        for y in range(y0 - hh, y0):
            r, g, b = px[x, y]
            if g > r + 20 and g > b + 20:
                top = y
                break
        heights.append(0 if top is None else y0 - top)
    # a burst is a run of at least four columns rising past 30 percent of the
    # axis: blips from a molecule grazing the layer do not count
    thresh = hh * 0.30
    runs, run = 0, 0
    for h in heights:
        if h > thresh:
            run += 1
        else:
            if run >= 4:
                runs += 1
            run = 0
    if run >= 4:
        runs += 1
    return runs


def slice_to_gif(shot, cfg, cols, rows, fw, fh, out_path):
    sheet = Image.open(shot).convert("RGB")
    frames = []
    for i in range(cols * rows):
        x, y = (i % cols) * fw, (i // cols) * fh
        frames.append(sheet.crop((x, y, x + fw, y + fh)))
    while len(frames) > 2:   # cells never drawn stay white
        px = frames[-1].getcolors(maxcolors=1)
        if px and px[0][1] == (255, 255, 255):
            frames.pop()
        else:
            break
    uniq = [frames[0]]
    for f in frames[1:]:
        if ImageChops.difference(f, uniq[-1]).getbbox() is not None:
            uniq.append(f)
    frames = uniq
    ms = cfg["ms"]
    dur = ms
    xs = []
    if cfg["hold"]:
        # the crossing lasts only a few frames however long the loop runs, so
        # frames inside a completed crossing stay on screen longer. Only those:
        # an excursion onto the barrier that falls back into the same well is
        # left at normal speed.
        xs = walker_xs(frames)
        dur = [ms] * len(xs)
        for a, b in crossing_segments(xs):
            for i in range(a, b + 1):
                dur[i] = cfg["hold"]
    # per-frame adaptive palettes and optimize=False: a shared palette flattens
    # faint motion, and optimize merges frames and sums their durations
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=255) for f in frames]
    pal[0].save(out_path, save_all=True, append_images=pal[1:],
                duration=dur, loop=0, optimize=False, disposal=1)
    return frames, xs


def main():
    which = sys.argv[1:] or list(JOBS)
    os.makedirs(OUT, exist_ok=True)
    for fig in which:
        cfg = JOBS[fig]
        final = os.path.join(OUT, cfg["name"])
        cand = os.path.join(tempfile.gettempdir(), "cand_%s.gif" % fig)
        shot = os.path.join(tempfile.gettempdir(), "capture_%s.png" % fig)
        best = None
        for attempt in range(1, cfg["attempts"] + 1):
            if os.path.exists(shot):
                os.remove(shot)
            dsf = DSF
            cols, rows, fw, fh = capture(fig, cfg, shot, dsf)
            if not os.path.exists(shot) and dsf > 1:
                print("   (double-density screenshot failed, falling back to single)")
                dsf = 1
                cols, rows, fw, fh = capture(fig, cfg, shot, dsf)
            if not os.path.exists(shot):
                raise SystemExit("no screenshot written for " + fig)
            frames, xs = slice_to_gif(shot, cfg, cols, rows, fw, fh, cand)
            if fig == "hero":
                if not xs:
                    xs = walker_xs(frames)
                nc = count_crossings(xs)
                held = sum(1 for x in xs if 0.33 < x < 0.67)
                ok = len(frames) >= cols * rows - 2 and nc >= cfg["min_cross"]
                score = nc * 100 + len(frames)
                print("   attempt %d: %2d frames, %d crossings, %d frames on the barrier%s"
                      % (attempt, len(frames), nc, held, "  accepted" if ok else ""))
            else:
                nb = count_bursts(frames[-1], cfg["src"])
                ok = len(frames) >= cols * rows - 2 and nb >= cfg.get("min_bursts", 0)
                score = nb * 100 + len(frames)
                print("   attempt %d: %2d frames, %d bursts in the final trace%s"
                      % (attempt, len(frames), nb, "  accepted" if ok else ""))
            if best is None or score > best:
                best = score
                shutil.copyfile(cand, final)
            if ok:
                break
        fr = frames_of(final)
        im = Image.open(final)
        total_ms = 0
        for i in range(len(fr)):
            im.seek(i)
            total_ms += im.info.get("duration", cfg["ms"])
        print("%-5s %2d frames  %dx%d  %5.0f KB  loop %.1f s  %s"
              % (fig, len(fr), fr[0].width, fr[0].height, os.path.getsize(final) / 1024, total_ms / 1000.0, final))
        print("      %s" % cfg["note"])


if __name__ == "__main__":
    main()
