"""
pictograms.py - simple line pictograms for Atlas tiles that have no photograph yet.

Each entry is the inner markup of an SVG <symbol> on a 48 x 48 grid, drawn with
stroke="currentColor" so the tile's CSS colour applies. picto_key() maps a species
(category, order, family) to one of them; anything unknown falls back to "leaf".
"""

STYLE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

PICTO = {
    "bird": (
        '<path d="M8 30C8 22 14 16 22 16c5 0 9 2 11 5l8-1-7 4c-1 8-7 13-14 13-5 0-10-3-12-7z"/>'
        '<path d="M8 30l-5 4M18 37v6M24 37v6M5 43h38"/>'
        '<circle cx="29" cy="21" r="1.2" fill="currentColor" stroke="none"/>'
    ),
    "wader": (
        '<path d="M14 27c0-5 5-8 11-8s11 3 11 8-5 8-11 8-11-3-11-8z"/>'
        '<path d="M33 22c3-5 4-9 3-13"/>'
        '<circle cx="35" cy="8" r="2.5"/>'
        '<path d="M33 9l-7 3M22 35l-2 11M28 35l1 11M17 46h6M26 46h6M14 27l-7 3"/>'
    ),
    "bee": (
        '<ellipse cx="24" cy="30" rx="8" ry="10"/>'
        '<path d="M17 27h14M17 33h14"/>'
        '<circle cx="24" cy="16" r="4"/>'
        '<path d="M22 13l-3-5M26 13l3-5M18 24c-8-6-14-2-9 4M30 24c8-6 14-2 9 4M17 33l-6 3M31 33l6 3M24 40v3"/>'
    ),
    "butterfly": (
        '<path d="M24 14v22"/>'
        '<circle cx="24" cy="12" r="2"/>'
        '<path d="M23 10l-3-5M25 10l3-5"/>'
        '<path d="M24 20C16 8 6 12 8 20c1 5 8 6 16 4zM24 20c8-12 18-8 16 0-1 5-8 6-16 4z"/>'
        '<path d="M24 26c-7 0-14 4-12 10 2 4 8 2 12-2zM24 26c7 0 14 4 12 10-2 4-8 2-12-2z"/>'
    ),
    "dragonfly": (
        '<path d="M24 12v32M22 36h4M22 40h4"/>'
        '<circle cx="24" cy="9" r="3"/>'
        '<path d="M24 18C14 12 4 14 6 19c2 4 10 3 18-1zM24 18c10-6 20-4 18 1-2 4-10 3-18-1z"/>'
        '<path d="M24 24c-9-3-18-1-16 3 2 3 9 1 16-3zM24 24c9-3 18-1 16 3-2 3-9 1-16-3z"/>'
    ),
    "insect": (
        '<ellipse cx="24" cy="29" rx="9" ry="12"/>'
        '<path d="M24 17v24"/>'
        '<circle cx="24" cy="12" r="4"/>'
        '<path d="M21 9l-3-5M27 9l3-5M15 25l-6-3M15 30l-7 1M16 36l-5 5M33 25l6-3M33 30l7 1M32 36l5 5"/>'
    ),
    "ant": (
        '<circle cx="12" cy="28" r="4"/><circle cx="23" cy="28" r="5"/><circle cx="35" cy="27" r="6"/>'
        '<path d="M9 25l-4-6M13 24l-2-7M20 24l-3-7M26 24l3-7M18 29l-6 3M28 29l6 3M21 32l-3 7M25 32l3 7"/>'
    ),
    "worm": (
        '<path d="M5 32c5-12 11-12 16 0s11 12 16 0c2-5 5-6 6-3"/>'
        '<circle cx="42" cy="28" r="2.5"/>'
    ),
    "spider": (
        '<ellipse cx="24" cy="19" rx="6" ry="7"/>'
        '<circle cx="24" cy="31" r="4"/>'
        '<path d="M20 30C14 28 10 22 6 16M20 32c-6 0-11 0-16-2M20 34c-5 4-10 6-14 10M21 28c-5-8-9-12-11-18"/>'
        '<path d="M28 30c6-2 10-8 14-14M28 32c6 0 11 0 16-2M28 34c5 4 10 6 14 10M27 28c5-8 9-12 11-18"/>'
    ),
    "millipede": (
        '<path d="M8 28c4-6 28-6 32 0-4 6-28 6-32 0z"/>'
        '<path d="M12 33v5M16 34v5M20 34v5M24 34v5M28 34v5M32 34v5M36 33v5"/>'
        '<circle cx="42" cy="28" r="3"/>'
        '<path d="M44 26l3-4M44 30l3 4"/>'
    ),
    "snail": (
        '<circle cx="29" cy="26" r="10"/>'
        '<path d="M29 26c4 0 6-3 4-6M29 26c-4 0-6 4-3 6"/>'
        '<path d="M19 33c-6 0-11 2-13 7h26M10 36l-4-8M14 36l-1-9"/>'
        '<circle cx="6" cy="28" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="27" r="1" fill="currentColor" stroke="none"/>'
    ),
    "crab": (
        '<ellipse cx="24" cy="28" rx="11" ry="7"/>'
        '<path d="M18 21v-5M30 21v-5"/>'
        '<circle cx="18" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="30" cy="15" r="1.2" fill="currentColor" stroke="none"/>'
        '<path d="M13 26C8 22 6 16 10 14M10 14l4 4M35 26c5-4 7-10 3-12M38 14l-4 4"/>'
        '<path d="M14 32l-6 6M18 34l-4 8M34 32l6 6M30 34l4 8"/>'
    ),
    "fish": (
        '<path d="M6 24c6-10 16-12 24-6l10-6-3 12 3 12-10-6c-8 6-18 4-24-6z"/>'
        '<path d="M20 18c2-4 6-4 7-1M14 18c0 4 0 8 0 12"/>'
        '<circle cx="13" cy="23" r="1.2" fill="currentColor" stroke="none"/>'
    ),
    "frog": (
        '<ellipse cx="24" cy="30" rx="12" ry="9"/>'
        '<circle cx="17" cy="21" r="3.5"/><circle cx="31" cy="21" r="3.5"/>'
        '<circle cx="17" cy="21" r="1" fill="currentColor" stroke="none"/><circle cx="31" cy="21" r="1" fill="currentColor" stroke="none"/>'
        '<path d="M12 32c-6 0-8 4-6 8M36 32c6 0 8 4 6 8M16 38l-4 6M32 38l4 6M19 31c2 2 8 2 10 0"/>'
    ),
    "snake": (
        '<path d="M4 36c6-10 12-10 18 0s12 10 18 0c4-6 2-12-4-14"/>'
        '<circle cx="34" cy="20" r="3"/>'
        '<path d="M31 19l-5-1M31 20l-4 2"/>'
        '<circle cx="35" cy="19" r="0.8" fill="currentColor" stroke="none"/>'
    ),
    "lizard": (
        '<path d="M12 26c0-4 6-6 12-6s12 2 12 6-6 6-12 6-12-2-12-6z"/>'
        '<path d="M36 26c4 0 6-2 8-4-2-1-6-1-8 2M12 26c-6 0-10 6-8 14M17 22l-4-6M31 22l4-6M17 30l-4 6M31 30l4 6"/>'
        '<circle cx="40" cy="23" r="1" fill="currentColor" stroke="none"/>'
    ),
    "turtle": (
        '<path d="M10 28c0-10 6-16 14-16s14 6 14 16z"/>'
        '<path d="M6 28h36M38 28c4 0 6-3 6-6M14 28l-3 6M34 28l3 6M24 12v16M15 18c5 4 13 4 18 0"/>'
    ),
    "mammal": (
        '<path d="M10 21c0-2 2-4 4-4h15c3 0 5 2 5 4v8c0 2-2 3-4 3H14c-2 0-4-1-4-3z"/>'
        '<path d="M14 32v10M19 32v10M25 32v10M30 32v10M10 23l-4 4M33 18l4-8"/>'
        '<path d="M37 10l8 2-5 4-3-1z"/>'
        '<path d="M38 9l-2-5M40 9l2-5"/>'
    ),
    "bat": (
        '<path d="M24 18c-4-8-14-8-20-2 4 0 6 3 6 6 3-1 6 0 7 3 2-1 5-1 7 2 2-3 5-3 7-2 1-3 4-4 7-3 0-3 2-6 6-6-6-6-16-6-20 2z"/>'
        '<path d="M24 18v10M22 16l-1-4M26 16l1-4"/>'
    ),
    "tree": (
        '<path d="M24 5C14 5 8 12 8 20c0 7 5 12 12 13h8c7-1 12-6 12-13 0-8-6-15-16-15z"/>'
        '<path d="M21 33v10M27 33v10M12 43h24"/>'
    ),
    "herb": (
        '<path d="M24 44V12"/>'
        '<path d="M24 36c-7 0-12-5-12-12 7 0 12 5 12 12zM24 28c7 0 12-5 12-12-7 0-12 5-12 12zM24 20c-5 0-9-4-9-9 5 0 9 4 9 9z"/>'
        '<circle cx="24" cy="9" r="3"/>'
    ),
    "grass": (
        '<path d="M24 44c0-10-2-20-10-30M24 44c0-12 2-22 10-32M24 44c0-14 0-24 0-36M24 44c-2-8-8-14-16-16M24 44c2-8 8-14 16-16M10 44h28"/>'
    ),
    "crop": (
        '<path d="M24 44V6"/>'
        '<path d="M24 20c-4-2-6-6-4-9 3 1 5 5 4 9zM24 20c4-2 6-6 4-9-3 1-5 5-4 9zM24 26c-4-2-6-6-4-9 3 1 5 5 4 9zM24 26c4-2 6-6 4-9-3 1-5 5-4 9zM24 32c-4-2-6-6-4-9 3 1 5 5 4 9zM24 32c4-2 6-6 4-9-3 1-5 5-4 9z"/>'
    ),
    "aquatic": (
        '<path d="M4 38c4-3 8-3 12 0s8 3 12 0 8-3 12 0M4 44c4-3 8-3 12 0s8 3 12 0 8-3 12 0"/>'
        '<path d="M24 30c-3-6-3-14 0-22 3 8 3 16 0 22zM24 30c-7-2-12-8-12-16 6 2 10 8 12 16zM24 30c7-2 12-8 12-16-6 2-10 8-12 16zM24 30v8"/>'
    ),
    "mushroom": (
        '<path d="M8 24C8 13 15 6 24 6s16 7 16 18z"/>'
        '<path d="M19 24c0 7-1 13-1 18h12c0-5-1-11-1-18"/>'
        '<circle cx="18" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="28" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="32" cy="19" r="1.5" fill="currentColor" stroke="none"/>'
    ),
    "leaf": (
        '<path d="M8 40C8 22 22 8 40 8c0 18-14 32-32 32z"/>'
        '<path d="M8 40L36 12"/>'
    ),
}

WADER_ORDERS = {"Gruiformes", "Pelecaniformes", "Ciconiiformes", "Charadriiformes", "Suliformes"}
SNAKE_FAMILIES = {"Colubridae", "Elapidae", "Viperidae", "Pythonidae", "Boidae", "Natricidae", "Typhlopidae", "Erycidae"}


def picto_key(category, order="", family=""):
    """Choose the pictogram for a species from its vault category and taxonomy."""
    order, family = (order or "").strip(), (family or "").strip()
    if category == "fauna/birds":
        return "wader" if order in WADER_ORDERS else "bird"
    if category == "fauna/insects":
        if order == "Hymenoptera":
            return "ant" if family == "Formicidae" else "bee"
        if order == "Lepidoptera":
            return "butterfly"
        if order == "Odonata":
            return "dragonfly"
        return "insect"
    if category == "fauna/soil_fauna":
        if order in ("Isoptera", "Blattodea") or family in ("Termitidae", "Formicidae"):
            return "ant"
        if order in ("Haplotaxida", "Opisthopora", "Crassiclitellata", "Megadrilacea"):
            return "worm"
        return "insect"
    if category == "fauna/reptiles":
        if order == "Testudines":
            return "turtle"
        return "snake" if family in SNAKE_FAMILIES else "lizard"
    if category == "fauna/mammals":
        return "bat" if order == "Chiroptera" else "mammal"
    table = {
        "fauna/amphibians": "frog", "fauna/fish": "fish", "fauna/spiders": "spider",
        "fauna/myriapods": "millipede", "fauna/mollusks": "snail", "fauna/crustaceans": "crab",
        "flora/trees": "tree", "flora/weeds": "herb", "flora/shrubs": "herb", "flora/medicinal": "herb",
        "flora/climbers": "herb", "flora/grasses": "grass", "flora/crops": "crop", "flora/aquatic": "aquatic",
        "lower_plants/mosses": "herb", "lower_plants/ferns": "herb",
    }
    if category.startswith("fungi"):
        return "mushroom"
    return table.get(category, "leaf")


def symbol(key):
    return '<symbol id="pic-%s" viewBox="0 0 48 48" %s>%s</symbol>' % (key, STYLE, PICTO[key])


def sprite(keys):
    """An invisible inline sprite holding only the symbols the page uses."""
    body = "".join(symbol(k) for k in sorted(set(keys)) if k in PICTO)
    return ('<svg class="atlas-sprite" width="0" height="0" aria-hidden="true" focusable="false">'
            "<defs>%s</defs></svg>" % body)


def preview_html():
    cells = "".join('<figure><svg viewBox="0 0 48 48" %s>%s</svg><figcaption>%s</figcaption></figure>' % (STYLE, v, k)
                    for k, v in PICTO.items())
    return ("<!doctype html><meta charset=utf-8><title>pictograms</title>"
            "<style>body{font:14px system-ui;margin:24px;color:#1f2328;background:#fff}"
            "div{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}"
            "figure{margin:0;text-align:center}svg{width:120px;height:120px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:4px}"
            "</style><div>%s</div>" % cells)


if __name__ == "__main__":
    import sys
    sys.stdout.write(preview_html())
