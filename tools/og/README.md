# Social preview card

`assets/img/og-card.png` is the picture that appears when the site is pasted into
WhatsApp, Slack, LinkedIn, X or a search result card. It is 1200x630, the size those
services expect, and it is declared on every page as `og:image` and `twitter:image`.

It is rendered from `og-card.html` in this folder, which pulls the real portrait and the
landscape figure from `assets/`, so editing that file and re-rendering is the way to
change the card.

```text
chrome --headless=new --disable-gpu --hide-scrollbars ^
  --window-size=1200,630 --force-device-scale-factor=1 --virtual-time-budget=6000 ^
  --screenshot="G:\My Drive\Anu\Satya\WebSite_github\assets\img\og-card.png" ^
  "file:///G:/My Drive/Anu/Satya/WebSite_github/tools/og/og-card.html"
```

Both paths must be absolute. A relative `--screenshot` path writes nothing at all and
reports no error, and the page argument has to be a `file:///` URL. On this machine
Chrome is at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Check afterwards
that the file is exactly 1200x630: a different size makes some services crop or refuse
it.

After a change goes live, the caches at
<https://developers.facebook.com/tools/debug/> and <https://cards-dev.twitter.com/validator>
can be asked to re-fetch the page, otherwise old previews keep showing for days.
LinkedIn has its own inspector at <https://www.linkedin.com/post-inspector/>.

Everything else in this pass lives at the site root: `sitemap.xml` lists the six pages,
`robots.txt` points crawlers at the sitemap and keeps them out of `_atlas_inbox/` and
`tools/`, and `index.html` carries a JSON-LD `Person` block naming the affiliation,
degrees, ORCID and profiles. Keep the ORCID and the profile links in that block in step
with the contact page.

Note for deployment: do not add a `.nojekyll` file. GitHub Pages runs Jekyll by default,
and Jekyll refuses to publish folders whose names begin with an underscore, which is what
keeps the photo inbox off the public site.
