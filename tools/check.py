"""Check the site before publishing.

    python tools/check.py

Looks for broken links and image paths, images missing alt text, pictures heavy
enough to slow the site down, pages missing from the sitemap, and private files
that have found their way into the repository. Reports and exits 1 if anything
looks wrong, so it can also be used in a script.

Nothing here talks to the network; DOIs and external links are not followed.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://satyaghoshmaurya.github.io"

PRIVATE = ("PLAN.md", "CURATION.md", "GEMINI.md", "FUTURE_DIRECTIONS_DRAFT.md",
           "RUNBOOK.md", "WHERE_THINGS_LIVE.md", ".nojekyll")

problems = []
notes = []


def rel(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


def pages():
    return sorted(f for f in os.listdir(ROOT) if f.endswith(".html"))


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read()


# ---------------------------------------------------------------- private files
for name in PRIVATE:
    if os.path.exists(os.path.join(ROOT, name)):
        problems.append("private file in the repository: %s  (see RUNBOOK part 6)" % name)

for folder in ("_atlas_inbox", "_archive_2026-09-13", "_presentation"):
    if os.path.isdir(os.path.join(ROOT, folder)):
        problems.append("private folder in the repository: %s/" % folder)

# ---------------------------------------------------------------- per page
html = {name: read(name) for name in pages()}
anchors = {}
for name, text in html.items():
    anchors[name] = set(re.findall(r'\sid="([^"]+)"', text))

for name, text in sorted(html.items()):
    # every local file a page points at must exist
    refs = re.findall(r'(?:src|href)="([^"]+)"', text)
    for ref in refs:
        if ref.startswith(("http://", "https://", "mailto:", "data:", "#", "//")):
            continue
        target, _, frag = ref.partition("#")
        if not target:
            if frag and frag not in anchors[name]:
                problems.append("%s: link to #%s, which is not on this page" % (name, frag))
            continue
        path = os.path.normpath(os.path.join(ROOT, target))
        if not os.path.exists(path):
            problems.append("%s: points at %s, which does not exist" % (name, target))
        elif frag and target.endswith(".html"):
            other = os.path.basename(target)
            if other in anchors and frag not in anchors[other]:
                problems.append("%s: link to %s#%s, and that page has no such section"
                                % (name, other, frag))

    # images need alt text, or a screen reader announces the filename
    for tag in re.findall(r"<img\b[^>]*>", text):
        if 'alt=' not in tag:
            src = re.search(r'src="([^"]*)"', tag)
            problems.append("%s: <img> with no alt text: %s"
                            % (name, src.group(1) if src else tag[:60]))

    # the head tags that make the page shareable and findable
    for needed, label in ((r'<title>', "a <title>"),
                          (r'name="description"', "a meta description"),
                          (r'rel="canonical"', "a canonical link"),
                          (r'property="og:image"', "an og:image")):
        if not re.search(needed, text):
            problems.append("%s: missing %s" % (name, label))

    # a favicon, so the browser tab is not a blank page icon
    if not re.search(r'rel="(icon|shortcut icon)"', text):
        notes.append("%s: no favicon link" % name)

# ---------------------------------------------------------------- images
for base, dirs, files in os.walk(os.path.join(ROOT, "assets")):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for f in files:
        if not f.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            continue
        p = os.path.join(base, f)
        kb = os.path.getsize(p) // 1024
        if kb > 3072:
            problems.append("%s is %d KB. Resize before publishing." % (rel(p), kb))
        elif kb > 500:
            notes.append("%s is %d KB, heavy for a web page." % (rel(p), kb))

# images nothing references
used = set()
for text in html.values():
    # relative references, and the absolute ones the social and canonical tags use
    for ref in re.findall(r'(?:src|href|data-full|content)="(?:%s/)?(assets/[^"]+)"'
                          % re.escape(SITE), text):
        used.add(ref.split("#")[0])
    for ref in re.findall(r"url\((assets/[^)]+)\)", text):
        used.add(ref.strip("'\""))
try:
    css = read(os.path.join("css", "style.css"))
    for ref in re.findall(r"url\(\.\./(assets/[^)]+)\)", css):
        used.add(ref.strip("'\""))
except OSError:
    pass
for base, dirs, files in os.walk(os.path.join(ROOT, "assets")):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for f in files:
        p = rel(os.path.join(base, f))
        if p not in used and not p.endswith((".md", ".txt")):
            notes.append("%s is not used by any page." % p)

# ---------------------------------------------------------------- sitemap
try:
    sm = read("sitemap.xml")
    listed = set(re.findall(r"<loc>([^<]+)</loc>", sm))
    for name in pages():
        url = SITE + "/" + ("" if name == "index.html" else name)
        if url not in listed and (SITE + "/" + name) not in listed:
            problems.append("sitemap.xml does not list %s" % name)
    for url in listed:
        tail = url[len(SITE) + 1:] or "index.html"
        if not os.path.exists(os.path.join(ROOT, tail)):
            problems.append("sitemap.xml lists %s, which does not exist" % url)
except OSError:
    problems.append("sitemap.xml is missing")

if not os.path.exists(os.path.join(ROOT, "robots.txt")):
    problems.append("robots.txt is missing")

# ---------------------------------------------------------------- report
print("Checked %d pages in %s\n" % (len(html), ROOT))

if problems:
    print("Problems (%d):" % len(problems))
    for p in problems:
        print("  x  " + p)
    print("")

if notes:
    print("Worth a look (%d):" % len(notes))
    for n in notes:
        print("  -  " + n)
    print("")

if not problems:
    print("No problems found.")

sys.exit(1 if problems else 0)
