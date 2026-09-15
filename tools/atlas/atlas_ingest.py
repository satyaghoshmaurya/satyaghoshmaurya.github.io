#!/usr/bin/env python3
"""
atlas_ingest.py - bring Satya's own Atlas photos from an inbox folder onto the website,
with species details pulled from the Awadh Biodiversity Atlas vault.

Stages (run from the website folder or anywhere with --site):

  python tools/atlas/atlas_ingest.py sheet
      Scan the inbox, read EXIF (date, GPS, camera), write or merge manifest.csv and
      render numbered contact sheets in <inbox>/_sheets/ for identification.

  python tools/atlas/atlas_ingest.py match
      Resolve the manifest "species" column (an Atlas ID, English, Hindi or scientific
      name, or a vault slug; a sub-folder name is used as the default) against the
      vault's species_index.csv and fill species_id / slug / match_score.

  python tools/atlas/atlas_ingest.py build [--vault]
      For rows with use=y: write web-sized JPEGs with all metadata stripped into
      assets/img/field/atlas/, write tools/atlas/atlas-photos.json and
      tools/atlas/atlas-gallery.fragment.html, and splice the fragment into hobbies.html
      between <!-- atlas-gallery:start --> and <!-- atlas-gallery:end --> when present.
      --vault also copies each photo into the vault's media/species/<slug>/ as a PNG so
      the vault's own scripts/sync_photos.js can pick it up.

Options: --inbox DIR, --site DIR, --vault-dir DIR override the defaults below.
Needs Pillow only. HEIC files additionally need "pip install pillow-heif".
Nothing here reads Google Photos directly; photos reach the inbox by download or by
sharing to the Drive folder from the phone.
"""

import argparse
import csv
import difflib
import io
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pictograms import picto_key, sprite  # noqa: E402

try:  # optional HEIC support
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
except Exception:  # noqa: BLE001
    pass

SITE_DEFAULT = Path(__file__).resolve().parents[2]
INBOX_DEFAULT = Path(r"G:\My Drive\Anu\Satya\WebSite_github\_atlas_inbox")
# The inbox stays in Google Drive, not in this repository, so photographs can be
# shared straight into it from Google Photos on the phone. Only resized copies with
# the camera metadata stripped are written into assets/img/field/atlas/ and published.
VAULT_DEFAULT = Path(r"G:\My Drive\New_Projects\Citizen_Science\Native_flora_fauna\awadh-biodiversity-atlas")
# The atlas publishes a page per species. Tiles link into it rather than repeating it.
ATLAS_SITE = "https://sgmaurya.github.io/awadh-biodiversity-atlas-site/"

WEB_SUBDIR = Path("assets") / "img" / "field" / "atlas"
FULL_EDGE = 1600           # longest edge of the enlarged image
THUMB_SIZE = (800, 600)    # 4:3 crop shown in the grid
CREDIT_DEFAULT = "Satyaghosh Maurya"
PLACE_DEFAULT = "Basti district, Uttar Pradesh"
IMG_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"}

MANIFEST_COLS = ["n", "file", "taken", "gps", "camera", "w", "h",
                 "species", "place", "note", "use", "credit", "type",
                 "species_id", "slug", "match_score"]

IUCN = {"LC": "Least Concern", "NT": "Near Threatened", "VU": "Vulnerable",
        "EN": "Endangered", "CR": "Critically Endangered", "DD": "Data Deficient",
        "NE": "Not Evaluated", "not_evaluated": "Not Evaluated"}

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


# --------------------------------------------------------------------------- helpers

def log(msg):
    print(msg, flush=True)


def read_manifest(path):
    if not path.exists():
        return []
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        for c in MANIFEST_COLS:
            r.setdefault(c, "")
    return rows


def write_manifest(path, rows):
    rows = sorted(rows, key=lambda r: int(r["n"] or 0))
    with io.open(path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=MANIFEST_COLS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in MANIFEST_COLS})


def rational(v):
    try:
        return float(v)
    except Exception:  # noqa: BLE001
        try:
            return v[0] / v[1]
        except Exception:  # noqa: BLE001
            return 0.0


def dms_to_deg(dms, ref):
    d, m, s = (rational(x) for x in dms)
    deg = d + m / 60.0 + s / 3600.0
    return -deg if ref in ("S", "W") else deg


def read_exif(path):
    """Return (taken 'YYYY-MM-DD HH:MM', gps 'lat,lon', camera, w, h)."""
    taken = gps = camera = ""
    w = h = 0
    try:
        with Image.open(path) as im:
            w, h = im.size
            exif = im.getexif()
            try:
                sub = exif.get_ifd(0x8769)
            except Exception:  # noqa: BLE001
                sub = {}
            raw = sub.get(36867) or sub.get(36868) or exif.get(306) or ""
            if raw:
                raw = str(raw).strip()
                try:
                    taken = datetime.strptime(raw[:19], "%Y:%m:%d %H:%M:%S").strftime("%Y-%m-%d %H:%M")
                except ValueError:
                    taken = raw
            make = str(exif.get(271) or "").strip()
            model = str(exif.get(272) or "").strip()
            camera = (model if make and model.lower().startswith(make.lower()) else " ".join(x for x in (make, model) if x)).strip()
            try:
                g = exif.get_ifd(0x8825)
            except Exception:  # noqa: BLE001
                g = {}
            if g and 2 in g and 4 in g:
                lat = dms_to_deg(g[2], g.get(1, "N"))
                lon = dms_to_deg(g[4], g.get(3, "E"))
                gps = "%.5f,%.5f" % (lat, lon)
            # orientation: report the displayed size
            o = exif.get(274)
            if o in (5, 6, 7, 8):
                w, h = h, w
    except Exception as e:  # noqa: BLE001
        log("  [!] cannot read %s: %s" % (path.name, e))
    if not taken:
        taken = datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M") + " (file date)"
    return taken, gps, camera, w, h


def load_font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:  # noqa: BLE001
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


# --------------------------------------------------------------------------- sheet

def cmd_sheet(args):
    inbox = Path(args.inbox)
    if not inbox.exists():
        inbox.mkdir(parents=True)
        log("Created empty inbox %s. Put photos there (sub-folders named by species are fine) and re-run." % inbox)
        return
    manifest_path = inbox / "manifest.csv"
    rows = read_manifest(manifest_path)
    known = {r["file"]: r for r in rows}

    files = []
    for p in sorted(inbox.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMG_EXT and "_sheets" not in p.parts:
            files.append(p)
    if not files:
        log("No images found in %s" % inbox)
        return

    new = []
    for p in files:
        rel = p.relative_to(inbox).as_posix()
        if rel in known:
            continue
        taken, gps, camera, w, h = read_exif(p)
        sub = p.relative_to(inbox).parts[:-1]
        new.append({"file": rel, "taken": taken, "gps": gps, "camera": camera,
                    "w": w, "h": h, "species": sub[-1] if sub else "",
                    "place": "", "note": "", "use": "", "credit": "", "type": "",
                    "species_id": "", "slug": "", "match_score": ""})
    new.sort(key=lambda r: r["taken"])
    next_n = max([int(r["n"] or 0) for r in rows] + [0]) + 1
    for r in new:
        r["n"] = str(next_n)
        next_n += 1
    rows.extend(new)
    missing = [r["file"] for r in rows if not (inbox / r["file"]).exists()]
    if missing:
        log("  [!] %d manifest rows point to files no longer in the inbox (kept): %s" % (len(missing), ", ".join(missing[:5])))
    write_manifest(manifest_path, rows)
    log("Manifest: %s (%d rows, %d new)" % (manifest_path, len(rows), len(new)))

    # contact sheets
    sheets_dir = inbox / "_sheets"
    sheets_dir.mkdir(exist_ok=True)
    for old in sheets_dir.glob("sheet_*.png"):
        old.unlink()
    rows_sorted = [r for r in sorted(rows, key=lambda r: int(r["n"])) if (inbox / r["file"]).exists()]
    per, cols, tw, th, label_h = 12, 4, 360, 270, 46
    font = load_font(18)
    small = load_font(14)
    for si in range(0, len(rows_sorted), per):
        chunk = rows_sorted[si:si + per]
        nrows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, nrows * (th + label_h)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, r in enumerate(chunk):
            x, y = (i % cols) * tw, (i // cols) * (th + label_h)
            try:
                with Image.open(inbox / r["file"]) as im:
                    im = ImageOps.exif_transpose(im).convert("RGB")
                    im.thumbnail((tw - 8, th - 8))
                    sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
            except Exception as e:  # noqa: BLE001
                draw.text((x + 10, y + 10), "unreadable: %s" % e, fill="red", font=small)
            draw.rectangle([x, y + th, x + tw - 1, y + th + label_h - 1], fill="#f2f2ee")
            draw.text((x + 8, y + th + 4), "#%s  %s" % (r["n"], Path(r["file"]).name[:34]), fill="black", font=font)
            draw.text((x + 8, y + th + 26), "%s  %s" % (r["taken"][:16], r["species"][:30]), fill="#555", font=small)
        out = sheets_dir / ("sheet_%02d.png" % (si // per + 1))
        sheet.save(out)
        log("Sheet: %s (#%s to #%s)" % (out, chunk[0]["n"], chunk[-1]["n"]))
    log("Next: identify each number, fill the species column (or sort into sub-folders), then run match.")


# --------------------------------------------------------------------------- match

def load_index(vault):
    path = vault / "species_index.csv"
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    cands = []  # (normalised string, row)
    for r in rows:
        for k in ("common_name_english", "common_name_hindi", "scientific_name"):
            r[k] = fix_text(r[k])
        slug = Path(r["file_path"]).stem
        r["slug"] = slug
        names = [r["id"], slug, slug.replace("_", " "), r["scientific_name"]]
        names += [x.strip() for x in r["common_name_english"].split("/")]
        names += [x.strip() for x in r["common_name_hindi"].split("/")]
        for nme in names:
            key = norm(nme)
            if len(key) >= 2:
                cands.append((key, r))
    return rows, cands


def fix_text(s):
    """Repair UTF-8 text that was saved through cp1252 (a few vault rows look like "à¤˜à¥‹")."""
    if "\u00e0\u00a4" in s or "\u00e0\u00a5" in s:
        try:
            return s.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def norm(s):
    return re.sub(r"[^a-z0-9\u0900-\u097f ]+", " ", s.lower()).strip()


def resolve(query, cands):
    q = norm(query)
    if not q:
        return None, 0.0
    for c, r in cands:
        if c == q:
            return r, 1.0
    # whole-word containment either way ("sarus" in "sarus crane"; "sarus crane" in "sarus crane pair")
    ids = {}
    if len(q) >= 4:
        for c, r in cands:
            if re.search(r"(?<!\S)%s(?!\S)" % re.escape(q), c) or (len(c) >= 5 and re.search(r"(?<!\S)%s(?!\S)" % re.escape(c), q)):
                ids.setdefault(r["id"], r)
    if len(ids) == 1:
        return next(iter(ids.values())), 0.9
    if len(ids) > 1:
        log("      ambiguous %r: %s" % (query, "; ".join("%s %s (%s)" % (r["id"], r["common_name_english"].split("/")[0].strip(), r["scientific_name"]) for r in ids.values())))
        return None, 0.0
    # spelling slips
    keys = [c for c, _ in cands]
    best = difflib.get_close_matches(q, keys, n=1, cutoff=0.7)
    if best:
        r = next(r for c, r in cands if c == best[0])
        return r, difflib.SequenceMatcher(None, q, best[0]).ratio()
    return None, 0.0


def cmd_match(args):
    inbox, vault = Path(args.inbox), Path(args.vault_dir)
    manifest_path = inbox / "manifest.csv"
    rows = read_manifest(manifest_path)
    if not rows:
        log("No manifest at %s; run sheet first." % manifest_path)
        return
    _, cands = load_index(vault)
    n_ok = n_bad = 0
    for r in sorted(rows, key=lambda r: int(r["n"] or 0)):
        if not r["species"].strip():
            continue
        if r["species_id"] and not args.force:
            continue
        hit, score = resolve(r["species"], cands)
        if hit:
            r["species_id"], r["slug"], r["match_score"] = hit["id"], hit["slug"], "%.2f" % score
            flag = "" if score >= 0.85 else "   <- check"
            log("#%-3s %-28s -> %s %s (%s)%s" % (r["n"], r["species"][:28], hit["id"], hit["common_name_english"].split("/")[0].strip(), hit["scientific_name"], flag))
            n_ok += 1
        else:
            r["species_id"] = r["slug"] = ""
            r["match_score"] = "0"
            log("#%-3s %-28s -> NO MATCH in the vault (new species? add it there first)" % (r["n"], r["species"][:28]))
            n_bad += 1
    write_manifest(manifest_path, rows)
    log("Matched %d, unmatched %d. Set use=y on the rows to publish, then run build." % (n_ok, n_bad))


# --------------------------------------------------------------------------- build

GROUPS = [
    ("Birds", ["fauna/birds"]),
    ("Insects", ["fauna/insects"]),
    ("Trees", ["flora/trees"]),
    ("Weeds, herbs and grasses", ["flora/weeds", "flora/shrubs", "flora/medicinal", "flora/grasses", "flora/climbers"]),
    ("Fish, snails and crabs", ["fauna/fish", "fauna/mollusks", "fauna/crustaceans"]),
    ("Reptiles and amphibians", ["fauna/reptiles", "fauna/amphibians"]),
    ("Spiders and soil life", ["fauna/spiders", "fauna/soil_fauna", "fauna/myriapods"]),
    ("Crops", ["flora/crops", "flora/crops_associated"]),
    ("Mammals", ["fauna/mammals"]),
    ("Mushrooms", ["fungi/mushrooms", "fungi/bracket_fungi", "fungi/lichens", "fungi/molds"]),
    ("Aquatic and lower plants", ["flora/aquatic", "lower_plants/mosses", "lower_plants/ferns",
                                  "lower_plants/liverworts", "lower_plants/algae"]),
]

LABEL = {"fauna/birds": "Bird", "fauna/insects": "Insect", "flora/trees": "Tree", "flora/weeds": "Weed",
         "flora/shrubs": "Shrub", "flora/medicinal": "Medicinal plant", "flora/grasses": "Grass",
         "flora/climbers": "Climber", "fauna/fish": "Fish", "fauna/mollusks": "Snail", "fauna/crustaceans": "Crustacean",
         "fauna/reptiles": "Reptile", "fauna/amphibians": "Amphibian", "fauna/spiders": "Spider",
         "fauna/soil_fauna": "Soil fauna", "fauna/myriapods": "Myriapod", "flora/crops": "Crop",
         "fauna/mammals": "Mammal", "fungi/mushrooms": "Mushroom", "flora/aquatic": "Aquatic plant",
         "lower_plants/mosses": "Moss", "lower_plants/ferns": "Fern"}


def parse_species_md(path):
    text = io.open(path, encoding="utf-8").read().lstrip("﻿")
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    fm, key = {}, None
    if m:
        for line in m.group(1).splitlines():
            if re.match(r"^\s+-\s", line) and key:
                fm.setdefault(key, [])
                if isinstance(fm[key], list):
                    fm[key].append(fix_text(line.split("-", 1)[1].strip().strip('"')))
            elif re.match(r"^[A-Za-z_]+:", line):
                key, _, val = line.partition(":")
                key, val = key.strip(), fix_text(val.strip().strip('"').strip("'"))
                fm[key] = val if val else []
    tip = ""
    t = re.search(r"\*\*Field tip:\*\*\s*(.+)", text)
    if t:
        tip = re.sub(r"\s+", " ", fix_text(t.group(1)).replace("*", "").replace("_", "")).strip()
        tip = re.sub(r"\s*[—–]\s*", ", ", tip)   # site style: no dashes in prose
        parts = re.split(r"(?<=[.!?])\s+", tip)
        tip = " ".join(parts[:2])
        if len(tip) > 280:
            tip = tip[:277].rsplit(" ", 1)[0] + "..."
    return fm, tip


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def month_year(taken):
    try:
        d = datetime.strptime(taken[:10], "%Y-%m-%d")
        return "%s %d" % (MONTHS[d.month - 1], d.year)
    except ValueError:
        return ""


def scalar(fm, key):
    v = fm.get(key, "")
    return v if isinstance(v, str) else ""


def kingdom_of(category):
    if category.startswith("fungi"):
        return "fungi"
    if category.startswith(("flora", "lower_plants")):
        return "plantae"
    return "animalia"


def status_line(idx):
    bits = [LABEL.get(idx["category"], idx["category"].split("/")[-1].replace("_", " ").capitalize())]
    if idx["native_status"] and idx["native_status"] != "native":
        bits.append(idx["native_status"])
    iucn = IUCN.get(idx["iucn_status"], "")
    if iucn and iucn not in ("Least Concern", "Not Evaluated"):
        bits.append("IUCN " + iucn)
    return ", ".join(bits)


def read_selection(path):
    if not path.exists():
        return []
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        return [(r["species_id"].strip(), (r.get("hook") or "").strip(), (r.get("hook_hi") or "").strip())
                for r in csv.DictReader(fh) if (r.get("species_id") or "").strip()]


def process_photos(args, inbox, site, vault, by_id, cands, prev):
    """Publish every manifest row with use=y; returns the photo records."""
    manifest_path = inbox / "manifest.csv"
    rows = read_manifest(manifest_path)
    out_dir = site / WEB_SUBDIR
    chosen = [r for r in sorted(rows, key=lambda r: int(r["n"] or 0)) if r["use"].strip().lower() in ("y", "yes", "1")]
    records, seq, changed = [], {}, False
    for r in chosen:
        if not r["species_id"]:
            hit, _ = resolve(r["species"], cands)
            if not hit:
                log("#%s skipped: species not resolved (%r)" % (r["n"], r["species"]))
                continue
            r["species_id"], r["slug"] = hit["id"], hit["slug"]
            changed = True
        idx = by_id.get(r["species_id"])
        if not idx:
            log("#%s skipped: %s not in species_index.csv" % (r["n"], r["species_id"]))
            continue
        src = inbox / r["file"]
        if not src.exists():
            log("#%s skipped: file missing %s" % (r["n"], src))
            continue
        out_dir.mkdir(parents=True, exist_ok=True)
        fm, tip = parse_species_md(vault / idx["file_path"])
        slug = idx["slug"]
        seq[slug] = seq.get(slug, 0) + 1
        nn = seq[slug]
        full_name = "%s_%02d.jpg" % (slug, nn)
        thumb_name = "%s_%02d_t.jpg" % (slug, nn)
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            full = im.copy()
            full.thumbnail((FULL_EDGE, FULL_EDGE))
            full.save(out_dir / full_name, "JPEG", quality=85, optimize=True, progressive=True)
            thumb = ImageOps.fit(im, THUMB_SIZE, method=Image.LANCZOS)
            thumb.save(out_dir / thumb_name, "JPEG", quality=80, optimize=True, progressive=True)
            fw, fh = full.size
        rec = {
            "source": r["file"], "n": int(r["n"]),
            "species_id": idx["id"], "slug": slug,
            "english": idx["common_name_english"].split("/")[0].strip(),
            "hindi": idx["common_name_hindi"].split("/")[0].strip(),
            "scientific": idx["scientific_name"], "family": scalar(fm, "family"),
            "field_tip": tip,
            "taken": r["taken"][:10], "when": month_year(r["taken"]),
            "place": r["place"].strip() or PLACE_DEFAULT,
            "credit": r["credit"].strip() or CREDIT_DEFAULT,
            "note": r["note"].strip(),
            "full": (WEB_SUBDIR / full_name).as_posix(), "full_w": fw, "full_h": fh,
            "thumb": (WEB_SUBDIR / thumb_name).as_posix(),
            "vault_file": prev.get(r["file"], {}).get("vault_file", ""),
        }
        if args.vault and not rec["vault_file"]:
            vdir = vault / "media" / "species" / slug
            vdir.mkdir(parents=True, exist_ok=True)
            ptype = (r["type"].strip() or "main")
            k = 1
            while (vdir / ("%s_%02d.jpg" % (ptype, k))).exists():
                k += 1
            vfile = vdir / ("%s_%02d.jpg" % (ptype, k))
            with Image.open(out_dir / full_name) as im:
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                im.thumbnail((1200, 1200))          # vault standard: longest edge 1200 px
                im.save(vfile, "JPEG", quality=85, optimize=True)
            rec["vault_file"] = vfile.relative_to(vault).as_posix()
            log("  vault: %s" % rec["vault_file"])
        records.append(rec)
        log("#%-3s %s -> %s" % (r["n"], rec["english"], full_name))
    if changed:
        write_manifest(manifest_path, rows)
    return records


def render_cards(cards):
    lines = ["<!-- atlas-gallery:start  (generated by tools/atlas/atlas_ingest.py from selection.csv and _atlas_inbox/manifest.csv; edit those, not this block) -->",
             sprite([c["picto"] for c in cards if not c["photos"]]),
             '<div class="atlas-grid">']
    for c in cards:
        lines.append('  <figure class="atlas-card" data-category="%s">' % esc(c["category"]))
        if c["photos"]:
            p = c["photos"][0]
            desc = ["%s, %s. %s%s." % (c["english"], c["hindi"], c["scientific"], (", " + c["family"]) if c["family"] else "")]
            where = ", ".join(x for x in (p["place"], p["when"]) if x)
            if where:
                desc.append(where + ".")
            if c["hook"]:
                desc.append(c["hook"])
            if c.get("hook_hi"):
                desc.append(c["hook_hi"])
            desc.append("Photo: %s." % p["credit"])
            alt = "%s (%s)%s" % (c["english"], c["scientific"], (", " + p["note"]) if p["note"] else "")
            lines.append('    <div class="atlas-media gallery-item" data-desc="%s">' % esc(" ".join(desc)))
            lines.append('      <img src="%s" data-full="%s" alt="%s" width="%d" height="%d" loading="lazy">'
                         % (p["thumb"], p["full"], esc(alt), THUMB_SIZE[0], THUMB_SIZE[1]))
            lines.append("    </div>")
        else:
            lines.append('    <a class="atlas-media atlas-empty atlas-link" href="%s" data-kingdom="%s" aria-label="%s, full entry in the atlas">'
                         % (c["url"], c["kingdom"], esc(c["english"])))
            lines.append('      <svg class="atlas-picto" aria-hidden="true"><use href="#pic-%s"/></svg><span class="atlas-soon">Open in the atlas &middot; <span lang="hi">एटलस में देखें</span></span>' % c["picto"])
            lines.append("    </a>")
        lines.append('    <figcaption class="atlas-cap">')
        lines.append('      <span class="atlas-name">%s <span class="atlas-hindi-inline" lang="hi">%s</span></span>' % (esc(c["english"]), esc(c["hindi"])))
        lines.append('      <span class="atlas-sci"><i>%s</i> &middot; %s</span>' % (esc(c["scientific"]), esc(c["status"])))
        if c["hook"]:
            lines.append('      <span class="atlas-hook">%s</span>' % esc(c["hook"]))
        if c.get("hook_hi"):
            lines.append('      <span class="atlas-hook atlas-hook-hi" lang="hi">%s</span>' % esc(c["hook_hi"]))
        if c["photos"]:
            lines.append('      <a class="atlas-open" href="%s">Full entry in the atlas &rarr;</a>' % c["url"])
        lines.append("    </figcaption>")
        lines.append("  </figure>")
    lines.append("</div>")
    lines.append("<!-- atlas-gallery:end -->")
    return "\n".join(lines)


def render_groups(index_rows):
    counted = set()
    groups = []
    for label, cats in GROUPS:
        n = sum(1 for r in index_rows if r["category"] in cats)
        counted.update(cats)
        if n:
            groups.append((label, n))
    other = sum(1 for r in index_rows if r["category"] not in counted)
    if other:
        groups.append(("Other", other))
    groups.sort(key=lambda g: -g[1])
    mx = max(n for _, n in groups)
    total = len(index_rows)
    lines = ["<!-- atlas-groups:start  (generated by tools/atlas/atlas_ingest.py from the vault's species_index.csv) -->",
             '<p class="atlas-total"><strong>%d species profiled so far</strong>, each with its Hindi and English names, identification, ecological role and references. The list grows every season.</p>' % total,
             '<p class="atlas-total-hi" lang="hi">अब तक %d प्रजातियाँ दर्ज हैं, हर एक के हिंदी और अंग्रेज़ी नाम, पहचान, पारिस्थितिक भूमिका और संदर्भ के साथ। हर मौसम में सूची बढ़ती है।</p>' % total,
             '<p class="atlas-visit">Each of them has its own page, in Hindi and English, with identification, ecological role, references and a freely licensed photograph where one exists. <a href="%s">Open the Awadh Biodiversity Atlas &rarr;</a></p>' % ATLAS_SITE,
             '<p class="atlas-visit atlas-total-hi" lang="hi">हर प्रजाति का अपना पृष्ठ है, हिंदी और अंग्रेज़ी दोनों में। <a href="%s">एटलस खोलें &rarr;</a></p>' % ATLAS_SITE,
             '<ul class="atlas-groups" aria-label="Species profiled by group">']
    for label, n in groups:
        lines.append('  <li><span class="ag-label">%s</span><span class="ag-bar" aria-hidden="true"><i style="--w:%d%%"></i></span><span class="ag-n">%d</span></li>'
                     % (esc(label), round(100.0 * n / mx), n))
    lines.append("</ul>")
    lines.append("<!-- atlas-groups:end -->")
    return "\n".join(lines), groups


def splice(html, name, fragment):
    a, b = html.find("<!-- %s:start" % name), html.find("<!-- %s:end -->" % name)
    if a == -1 or b == -1:
        return html, False
    nl = "\r\n" if "\r\n" in html else "\n"
    indent = re.search(r"([ \t]*)$", html[:a]).group(1)
    block = nl.join(indent + ln for ln in fragment.split("\n"))
    return html[:a - len(indent)] + block + html[b + len("<!-- %s:end -->" % name):], True


def cmd_build(args):
    inbox, site, vault = Path(args.inbox), Path(args.site), Path(args.vault_dir)
    index_rows, cands = load_index(vault)
    by_id = {r["id"]: r for r in index_rows}
    tools_dir = site / "tools" / "atlas"
    tools_dir.mkdir(parents=True, exist_ok=True)
    jpath = tools_dir / "atlas-photos.json"
    prev = {}
    if jpath.exists():
        try:
            prev = {p["source"]: p for p in json.load(io.open(jpath, encoding="utf-8"))["photos"]}
        except Exception:  # noqa: BLE001
            prev = {}

    photos = process_photos(args, inbox, site, vault, by_id, cands, prev) if (inbox / "manifest.csv").exists() else []
    if not photos:
        log("No published photos yet; tiles will show a pictogram until photographs arrive.")
    photos_by = {}
    for p in photos:
        photos_by.setdefault(p["species_id"], []).append(p)

    selection = read_selection(tools_dir / "selection.csv")
    hooks = {sid: (h, hh) for sid, h, hh in selection}
    order = [sid for sid, _, _ in selection] + [sid for sid in photos_by if sid not in hooks]
    cards = []
    for sid in order:
        idx = by_id.get(sid)
        if not idx:
            log("selection: %s is not in species_index.csv, skipped" % sid)
            continue
        fm, tip = parse_species_md(vault / idx["file_path"])
        cards.append({
            "species_id": sid, "slug": idx["slug"], "category": idx["category"], "kingdom": kingdom_of(idx["category"]),
            "english": idx["common_name_english"].split("/")[0].strip(),
            "hindi": idx["common_name_hindi"].split("/")[0].strip(),
            "scientific": idx["scientific_name"], "family": scalar(fm, "family"),
            "status": status_line(idx), "hook": hooks.get(sid, ("", ""))[0] or tip,
            "hook_hi": hooks.get(sid, ("", ""))[1],
            "picto": picto_key(idx["category"], scalar(fm, "order"), scalar(fm, "family")),
            "url": ATLAS_SITE + "species/" + idx["slug"] + "/",
            "photos": photos_by.get(sid, []),
        })
    gallery = render_cards(cards)
    groups_html, groups = render_groups(index_rows)

    json.dump({"generated": datetime.now().strftime("%Y-%m-%d %H:%M"), "species_profiled": len(index_rows),
               "groups": [{"label": l, "count": n} for l, n in groups],
               "cards": [{k: v for k, v in c.items() if k != "photos"} | {"photo_count": len(c["photos"])} for c in cards],
               "photos": photos},
              io.open(jpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    io.open(tools_dir / "atlas-gallery.fragment.html", "w", encoding="utf-8", newline="\n").write(gallery + "\n")
    io.open(tools_dir / "atlas-groups.fragment.html", "w", encoding="utf-8", newline="\n").write(groups_html + "\n")
    log("Wrote atlas-photos.json and two fragments: %d tiles (%d with a photo), %d groups, %d species profiled"
        % (len(cards), sum(1 for c in cards if c["photos"]), len(groups), len(index_rows)))

    hob = site / "hobbies.html"
    if hob.exists():
        html = io.open(hob, encoding="utf-8", newline="").read()
        html, ok1 = splice(html, "atlas-gallery", gallery)
        html, ok2 = splice(html, "atlas-groups", groups_html)
        if ok1 or ok2:
            io.open(hob, "w", encoding="utf-8", newline="").write(html)
        log("hobbies.html: gallery %s, groups %s" % ("spliced" if ok1 else "markers missing", "spliced" if ok2 else "markers missing"))


# --------------------------------------------------------------------------- main

def main():
    try:  # Hindi names must survive a cp1252 Windows console
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["sheet", "match", "build"])
    ap.add_argument("--inbox", default=str(INBOX_DEFAULT))
    ap.add_argument("--site", default=str(SITE_DEFAULT))
    ap.add_argument("--vault-dir", default=str(VAULT_DEFAULT))
    ap.add_argument("--force", action="store_true", help="match: re-resolve rows that already have a species_id")
    ap.add_argument("--vault", action="store_true", help="build: also copy photos into the vault media folders")
    args = ap.parse_args()
    if not Path(args.vault_dir).exists() and args.stage != "sheet":
        sys.exit("Vault not found at %s (use --vault-dir)" % args.vault_dir)
    {"sheet": cmd_sheet, "match": cmd_match, "build": cmd_build}[args.stage](args)


if __name__ == "__main__":
    main()
