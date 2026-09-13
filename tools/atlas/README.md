# Atlas photos: from Google Photos to the website

The species knowledge lives in the Awadh Biodiversity Atlas vault
(`G:\My Drive\New_Projects\Citizen_Science\Native_flora_fauna\awadh-biodiversity-atlas`,
332 species profiles, `species_index.csv` is the master list). The photos live in
Google Photos. This folder holds the script that joins the two and puts the result on
`hobbies.html`. The inbox deliberately stays in Google Drive while the site itself is
edited in this repository at `D:\Projects\website`.

Nothing here talks to Google Photos. Photos reach a plain folder first:

```text
G:\My Drive\Anu\Satya\WebSite_github\_atlas_inbox\   <- the inbox, in Drive, reachable from the phone
    IMG_2041.jpg                          <- loose photos are fine
    Ashy Prinia\IMG_2042.jpg              <- or sorted into a folder per species
    manifest.csv                          <- generated; the only file you edit
    _sheets\sheet_01.png                  <- generated contact sheets, numbered
```

## Satya's part

1. In Google Photos, search for the place or the subject (Basti, bird, insect, flower,
   mushroom, pond) and select the photos worth publishing. Add them to an album called
   "Atlas web" so the selection is kept.
2. Get them into the inbox. From a computer: open the album, select all, Download, unzip
   into the inbox. From the phone: select, Share, Google Drive, choose the _atlas_inbox
   folder. Both routes keep the original JPEG with its date and GPS.
3. Identify what you can. Either drop each photo into a sub-folder named after the
   species (English, Hindi, scientific name or Atlas ID all work), or leave it loose and
   fill the `species` column of `manifest.csv` after the sheet stage. Unknowns can stay
   blank; Claude proposes IDs from the contact sheets and you confirm.
4. Set `use` to `y` on the rows that should go public. Optional columns: `place` (a
   locality name, never coordinates), `note` (for the alt text, e.g. "breeding male"),
   `credit` if someone else took the photo, `type` (main, flowers, habitat) for the vault.

## The showcase on hobbies.html

`selection.csv` lists the species shown as tiles, in order, with a one-line hook in
Satya's voice in English (`hook`) and Hindi (`hook_hi`). `build` turns it into the
"A first dozen" grid: a species with a published photo gets the photo; one without gets
a tinted tile carrying a line pictogram of its kind (from `pictograms.py`, chosen by
category, order and family) and "Photograph to come". Photographed species that are not
in the selection are appended.
The "What the atlas covers" bars are counted from `species_index.csv` at build time, so
re-running `build` after new species are added to the vault updates them. Both blocks
sit between `atlas-groups` and `atlas-gallery` markers in `hobbies.html`.

To change the set: edit `selection.csv` (Atlas IDs from `species_index.csv`), run
`build`. To add a photo for a tile: put it in the inbox, run `sheet`, `match`, `build`.

## The script

```text
python tools/atlas/atlas_ingest.py sheet    # scan inbox, read EXIF, write manifest + contact sheets
python tools/atlas/atlas_ingest.py match    # resolve the species column against species_index.csv
python tools/atlas/atlas_ingest.py build    # web images, JSON, gallery fragment, splice into hobbies.html
python tools/atlas/atlas_ingest.py build --vault   # also file each photo into the vault's media folder
```

`build` writes `assets/img/field/atlas/<slug>_NN.jpg` (1600 px, EXIF and GPS stripped)
and `<slug>_NN_t.jpg` (800x600 crop for the grid), `tools/atlas/atlas-photos.json`
(every published photo with its species facts), and
`tools/atlas/atlas-gallery.fragment.html`. If `hobbies.html` contains
`<!-- atlas-gallery:start -->` and `<!-- atlas-gallery:end -->` the fragment is spliced
between them; otherwise paste it where the gallery belongs.

Species facts pulled per photo: English and Hindi names, scientific name, family, the
"Field tip" sentence from the species page, IUCN status when it is not Least Concern,
and the month and year of the photo. Exact dates and coordinates stay in the manifest and
never reach the site.

## Do not publish the vault's own images

`media/species/*/main_01.png` in the vault are small reference pictures saved as BMP
data under a .png name, with no EXIF and no source or licence recorded. They are fine
for identification inside the vault but must not go on the website. Only photos from the
inbox are published.

## Requirements

Python 3 with Pillow (present). HEIC files from an iPhone need `pip install pillow-heif`,
or export them as JPEG from Google Photos.
