# satyaghoshmaurya.github.io

The personal academic site of Satyaghosh Maurya, postdoctoral researcher in the Gilad
Haran Lab at the Weizmann Institute of Science. Live at
<https://satyaghoshmaurya.github.io/>.

Plain static HTML, CSS and vanilla JavaScript. No build step, no framework, no backend,
no dependencies. GitHub Pages serves the repository root, so a push to `main` is the
deployment.

## Pages

| File | Contents |
| ---- | -------- |
| `index.html` | Home: who I am, an interactive conformational landscape, research themes, trajectory |
| `research.html` | The research programme, with interactive figures for each method |
| `publications.html` | Peer-reviewed articles, grouped by year, with DOIs and BibTeX |
| `cv.html` | Appointments, education, projects, honours, conferences, teaching, skills |
| `hobbies.html` | Paintings, the Awadh Biodiversity Atlas, and reading |
| `contact.html` | Addresses and profiles |

## How it is put together

- `css/style.css` is the single stylesheet. Colours, fonts and spacing are CSS variables
  at the top. Light theme by default, with an opt-in dark theme remembered in
  `localStorage`.
- `js/` holds one small module per interactive figure, plus `main.js` for the navigation,
  theme toggle and gallery. Each figure draws on a canvas, takes its colours from the CSS
  variables, stops when scrolled out of view, honours `prefers-reduced-motion`, and starts
  paused so the text can be read first.
- `tools/atlas/` turns species data from the Awadh Biodiversity Atlas and field
  photographs into the gallery on the hobbies page. `tools/og/` renders the social
  preview card. Neither runs at page load; both are run by hand when the content changes.
- `sitemap.xml`, `robots.txt` and the structured data in `index.html` are for search
  engines and link previews.

## Working on it

Preview with any static server, for example `python -m http.server 8000`, or open
`index.html` directly, since every path is relative.

Do not add a `.nojekyll` file. GitHub Pages runs Jekyll, and Jekyll refusing to publish
folders whose names begin with an underscore is what keeps the unpublished photo inbox
off the public site.
