#!/usr/bin/env python3
"""Regenerate assets/img/research/landscape.png, the still of the hero landscape
used on the research page and the home page theme card.

It is rendered from the live module through the same capture page as the GIFs, so
the still can never drift from the figure again (the old file predated a fix and
showed the left wall of the potential clipped flat at the top).

    python tools/gif/make_still.py

Thirty-six frames are captured and the one with the protein closest to the top
of the barrier is kept, since the image illustrates a transition path.
"""
import os
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_gifs as M  # noqa: E402

OUT = os.path.join(M.SITE, "assets", "img", "research", "landscape.png")
CFG = dict(cols=6, rows=6, fw=1440, src=(1000, 650),
           extra="&kT=0.55&every=3&fscale=1.1")

# The home page shows the same figure in a card about 350 px wide. Downscaling
# the big still by four makes its labels illegible, so the card gets its own
# render: a smaller frame with the type scaled up to suit it.
OUT_CARD = os.path.join(M.SITE, "assets", "img", "research", "landscape-card.png")
CFG_CARD = dict(cols=6, rows=6, fw=760, src=(1000, 650),
                extra="&kT=0.55&every=3&fscale=2.4")


def render(cfg, out):
    shot = os.path.join(tempfile.gettempdir(), "capture_still.png")
    best = None
    for attempt in range(1, 7):
        if os.path.exists(shot):
            os.remove(shot)
        cols, rows, fw, fh = M.capture("hero", cfg, shot, M.DSF)
        if not os.path.exists(shot):
            cols, rows, fw, fh = M.capture("hero", cfg, shot, 1)
        sheet = Image.open(shot).convert("RGB")
        frames = [sheet.crop(((i % cols) * fw, (i // cols) * fh,
                              (i % cols) * fw + fw, (i // cols) * fh + fh))
                  for i in range(cols * rows)]
        xs = M.walker_xs(frames)
        i = min(range(len(xs)), key=lambda k: abs(xs[k] - 0.5))
        miss = abs(xs[i] - 0.5)
        print("attempt %d: closest frame %d at x = %.2f" % (attempt, i, xs[i]))
        if best is None or miss < best[0]:
            best = (miss, frames[i])
        if miss < 0.04:
            break
    frame = best[1]
    land_h = round(frame.width * 380 / 1000)       # the landscape canvas only
    still = frame.crop((0, 0, frame.width, land_h))
    still = still.convert("P", palette=Image.ADAPTIVE, colors=128)
    still.save(out, optimize=True)
    print("wrote %s  %dx%d  %.0f KB" % (out, still.width, still.height,
                                        os.path.getsize(out) / 1024))


def main():
    render(CFG, OUT)
    render(CFG_CARD, OUT_CARD)


if __name__ == "__main__":
    main()
