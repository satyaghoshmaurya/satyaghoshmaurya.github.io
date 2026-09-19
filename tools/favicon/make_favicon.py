"""Draw the site's favicon: a molecule sitting on top of its energy barrier.

The mark is the same double-well potential the home page animates,
U(x) = (x^2 - 1)^2 - 0.12x, with a dot at the barrier top. That is the moment
the whole site is about, and it stays legible when shrunk to a browser tab.

    python tools/favicon/make_favicon.py

Writes, at the repository root:
    favicon.ico          16, 32 and 48 px, for older browsers and bookmarks
    favicon.svg          scalable, used by current browsers
    assets/img/icon/apple-touch-icon.png    180 px, for an iOS home screen
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICON_DIR = os.path.join(ROOT, "assets", "img", "icon")

INK = (31, 35, 40)        # --text, the site's near-black
CURVE = (246, 248, 250)   # --bg-alt, an off-white that stays soft at 16 px
DOT = (210, 153, 34)      # the amber the hero figure marks transition paths with

XL, XR = -1.42, 1.42      # how much of the landscape to show
PAD = 0.16                # margin inside the tile, as a fraction of its width
SS = 8                    # supersampling factor, for smooth curves


def U(x):
    return (x * x - 1.0) ** 2 - 0.12 * x


def curve_points(size):
    """The potential, mapped into a square of the given pixel size."""
    xs = [XL + (XR - XL) * i / 400.0 for i in range(401)]
    us = [U(x) for x in xs]
    umin, umax = min(us), max(us)
    pad = PAD * size
    span = size - 2 * pad

    def px(x):
        return pad + span * (x - XL) / (XR - XL)

    def py(u):
        # a little headroom above the barrier so the dot is not clipped
        return pad + 0.20 * span + 0.80 * span * (umax - u) / (umax - umin)

    return [(px(x), py(u)) for x, u in zip(xs, us)], px, py


def draw(size):
    s = size * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(0.22 * s), fill=INK + (255,))

    pts, px, py = curve_points(s)
    width = max(SS, int(0.085 * s))
    d.line(pts, fill=CURVE + (255,), width=width, joint="curve")
    # round off the two ends, which `line` leaves square
    for end in (pts[0], pts[-1]):
        r = width / 2.0
        d.ellipse([end[0] - r, end[1] - r, end[0] + r, end[1] + r], fill=CURVE + (255,))

    # the molecule, poised at the top of the barrier. It sits just above the
    # peak rather than on it, so the barrier is still visible underneath.
    r = 0.125 * s
    cx, cy = px(0.0), py(U(0.0)) - 0.055 * s
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DOT + (255,))

    return im.resize((size, size), Image.LANCZOS)


def svg():
    """The same drawing, as a path, so large sizes stay crisp."""
    n = 64
    pts, px, py = curve_points(64.0)
    step = max(1, len(pts) // n)
    sampled = pts[::step] + [pts[-1]]
    path = "M " + " L ".join("%.2f %.2f" % p for p in sampled)
    cx, cy = px(0.0), py(U(0.0)) - 0.055 * 64.0
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        '  <title>Satyaghosh Maurya</title>\n'
        '  <rect width="64" height="64" rx="14" fill="#1f2328"/>\n'
        '  <path d="%s" fill="none" stroke="#f6f8fa" stroke-width="5.4"\n'
        '        stroke-linecap="round" stroke-linejoin="round"/>\n'
        '  <circle cx="%.2f" cy="%.2f" r="8.0" fill="#d29922"/>\n'
        "</svg>\n" % (path, cx, cy)
    )


def main():
    os.makedirs(ICON_DIR, exist_ok=True)

    big = draw(256)
    big.save(os.path.join(ROOT, "favicon.ico"),
             sizes=[(16, 16), (32, 32), (48, 48)])

    # iOS crops transparent corners oddly, so the touch icon is drawn square
    touch = Image.new("RGB", (180, 180), INK)
    touch.paste(draw(180).convert("RGB"), (0, 0))
    touch.save(os.path.join(ICON_DIR, "apple-touch-icon.png"))

    with open(os.path.join(ROOT, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg())

    for p in ("favicon.ico", "favicon.svg",
              "assets/img/icon/apple-touch-icon.png"):
        full = os.path.join(ROOT, p.replace("/", os.sep))
        print("%-38s %6d bytes" % (p, os.path.getsize(full)))


if __name__ == "__main__":
    main()
