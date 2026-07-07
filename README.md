# Personal academic site

Plain static HTML/CSS/JS — no build step, no framework, no backend.
Works directly as a GitHub Pages site.

## Structure

```
index.html         Home
research.html       Research interests + statement
publications.html   Publication list (with topic filter)
cv.html             CV timeline + embedded PDF
hobbies.html        Personal interests page
contact.html        Contact info
css/style.css       All styling (colors/fonts are CSS variables at the top)
js/main.js          Small vanilla-JS helpers (mobile nav, pub filter)
assets/img/         Photo(s)
assets/cv/          CV PDF
```

Every page repeats the same sidebar/nav markup (no templating). If you
rename a page or change the nav, update it in all six files — search
for `<nav>` to find each spot.

## Editing content

- Text: edit directly in the `.html` files, they're plain HTML.
- Colors/fonts: edit the `:root { ... }` block at the top of `css/style.css`.
- Photo: replace `assets/img/satyaghosh-photo.jpg` (keep the filename, or
  update the `<img src>` in `index.html`).
- CV: replace `assets/cv/Satyaghosh_Maurya_CV.pdf` (keep the filename, or
  update the links/embed in `cv.html` and `index.html`).
- Publications: copy/edit a `<div class="pub">` block in `publications.html`.
  Set `data-pub-topics` to a comma-separated list matching the filter
  button keys (`folding`, `membrane`, `review`, or add your own — just
  add a matching `<button data-pub-filter="...">` too).

## Placeholders to fill in before it's "real"

Search for `placeholder` (case-insensitive) across the files, plus:
- Google Scholar, GitHub, LinkedIn, ORCID links (currently `href="#"`) —
  in `index.html` and `contact.html`
- Research statement text (`research.html`)
- Hobbies page sections + photos (`hobbies.html`)
- Institutional address, if it needs correcting (`contact.html`)

## Deploying to GitHub Pages

**Option A — personal site (`yourusername.github.io`):**
1. Create a repo named exactly `yourusername.github.io`.
2. Push these files to its `main` branch (root, not a subfolder).
3. Visit `https://yourusername.github.io` after a minute or two.

**Option B — project site (`yourusername.github.io/reponame`):**
1. Push these files to any repo, root of `main` branch.
2. In the repo Settings → Pages, set source to `main` / `/(root)`.
3. Visit `https://yourusername.github.io/reponame`.

No Jekyll config is required — GitHub Pages will serve these files as-is.
(A `.nojekyll` file is included so GitHub doesn't try to process folders
starting with `_` or similar, in case you add any later.)
