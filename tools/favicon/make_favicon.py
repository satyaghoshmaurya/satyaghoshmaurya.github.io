"""Draw the site's favicon: the monogram SM in Newsreader Bold, the serif the
site's headings use, in off-white on the site's near-black tile.

Chosen 2026-10-27 over the earlier double-well mark, which collapsed into a
"W" at browser-tab size. Two bold letters survive 16 px; a landscape does not.

    python tools/favicon/make_favicon.py

Writes, at the repository root:
    favicon.ico          16, 32 and 48 px, for older browsers and bookmarks
    favicon.svg          scalable, used by current browsers (glyph outlines, no font needed)
    assets/img/icon/apple-touch-icon.png    180 px, for an iOS home screen

Needs Pillow and fontTools, and Newsreader-Bold.ttf beside this script
(SIL Open Font License, see OFL-Newsreader.txt).
"""
import os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ICON_DIR = os.path.join(ROOT, "assets", "img", "icon")
FONT = os.path.join(HERE, "Newsreader-Bold.ttf")

INK = (31, 35, 40)        # --text, the site's near-black
PAPER = (246, 248, 250)   # --bg-alt, an off-white that stays soft at 16 px
TEXT = "SM"
EM = 0.62                 # font size as a fraction of the tile
TRACK = -0.06             # letter spacing as a fraction of the tile (tight, so the pair reads as one mark)
RADIUS = 0.22             # corner radius of the tile
SS = 8                    # supersampling for the raster tiles


def layout(size):
    """Where each letter goes, in pixels, for a tile of the given size. Measured
    from the font's own metrics so the raster and the SVG agree exactly."""
    tt = TTFont(FONT)
    upm = tt["head"].unitsPerEm
    cmap = tt.getBestCmap()
    gs = tt.getGlyphSet()
    scale = EM * size / upm
    glyphs = []
    for ch in TEXT:
        name = cmap[ord(ch)]
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        xmin, ymin, xmax, ymax = bp.bounds
        glyphs.append((name, xmin * scale, ymin * scale, xmax * scale, ymax * scale))
    gap = TRACK * size
    total = sum(g[3] - g[1] for g in glyphs) + gap * (len(glyphs) - 1)
    ymax = max(g[4] for g in glyphs)
    ymin = min(g[2] for g in glyphs)
    x = (size - total) / 2
    # baseline placed so that the pair's ink box is centred vertically (font y points up)
    baseline = size / 2 + (ymax + ymin) / 2
    placed = []
    for name, xmin, _, xmax, _ in glyphs:
        placed.append((name, x - xmin, baseline))
        x += (xmax - xmin) + gap
    return gs, scale, placed


def tile_svg(size=64):
    gs, scale, placed = layout(size)
    paths = []
    for name, dx, baseline in placed:
        pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        # font units -> tile pixels, y flipped, baseline placed
        tp = TransformPen(pen, (scale, 0, 0, -scale, dx, baseline))
        gs[name].draw(tp)
        paths.append(pen.getCommands())
    r = RADIUS * size
    return ("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 %d %d\">\n"
            "  <title>Satyaghosh Maurya</title>\n"
            "  <rect width=\"%d\" height=\"%d\" rx=\"%.0f\" fill=\"#%02x%02x%02x\"/>\n"
            "  <path d=\"%s\" fill=\"#%02x%02x%02x\"/>\n</svg>\n"
            % (size, size, size, size, r, INK[0], INK[1], INK[2], " ".join(paths), PAPER[0], PAPER[1], PAPER[2]))


def tile_png(size, square=False):
    s = size * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if square:
        d.rectangle([0, 0, s - 1, s - 1], fill=INK + (255,))
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(RADIUS * s), fill=INK + (255,))
    gs, scale, placed = layout(s)
    font = ImageFont.truetype(FONT, int(EM * s))
    for (name, dx, baseline), ch in zip(placed, TEXT):
        # anchor "ls": the point given is the left end of the baseline
        d.text((dx, baseline), ch, font=font, fill=PAPER + (255,), anchor="ls")
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    tiles = {n: tile_png(n) for n in (16, 32, 48)}
    tiles[48].save(os.path.join(ROOT, "favicon.ico"), format="ICO",
                   sizes=[(16, 16), (32, 32), (48, 48)],
                   append_images=[tiles[16], tiles[32]])
    # iOS crops transparent corners oddly, so the touch icon is drawn square
    tile_png(180, square=True).convert("RGB").save(os.path.join(ICON_DIR, "apple-touch-icon.png"))
    with open(os.path.join(ROOT, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(tile_svg())
    for p in ("favicon.ico", "favicon.svg", "assets/img/icon/apple-touch-icon.png"):
        full = os.path.join(ROOT, p.replace("/", os.sep))
        print("%-38s %6d bytes" % (p, os.path.getsize(full)))


if __name__ == "__main__":
    main()
