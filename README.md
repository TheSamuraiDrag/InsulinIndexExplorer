# Insulin Index Explorer

A fast, friendly website for searching and exploring the **insulin index (II) of 629 foods**, using
Supplemental Table 1 of:

> Hendricks SA, Paul MJ, Subramaniam Y, Vijayam B. A collectanea of food insulinaemic index: 2023.
> *Clinical Nutrition ESPEN*. 2024;63:92–104. https://doi.org/10.1016/j.clnesp.2024.06.017
> Open access, CC BY-NC-ND 4.0. Funded by Newcastle University Medicine Malaysia (NUMed).

Plain HTML, CSS and JavaScript. No build step, no backend, no framework. It runs on GitHub Pages.

## Pages

| Page | Address | What it does |
|---|---|---|
| Home | `#/` | Search, quick stats, food groups, badge legend, section tiles |
| Food Explorer | `#/explorer` | Instant search, filters, sort, detail panel, compare up to 3 |
| Food groups | `#/groups` | 14 groups with counts, II range and a dot strip of every food |
| Lowest-II picks | `#/lowest` | All 469 single foods ranked lowest first, separately for glucose and bread |
| Mixed meals | `#/mixed` | All 160 mixed meals |
| How to read the II | `#/guide` | What the II means, II vs GI, comparing like with like, median chart |
| About & sources | `#/about` | Citation, methods, footnotes, Table 2 note, limitations, licence |
| Data check (admin) | `#/admin` | The whole table laid out like the PDF, with checks and a review checklist |

Pages use hash addresses (`#/explorer?group=bread&ref=glucose`), so every view can be shared and
refreshing never gives a 404 on GitHub Pages. Explorer filters are saved in the address.

## Turn on GitHub Pages

1. Push this repository to GitHub.
2. On GitHub, open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your branch (for example `main`) and the **/ (root)** folder, then **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/<repository-name>/`.

All paths are relative, so the site works whatever the repository is called. To get the address
`…/insulin-index-explorer/`, name the repository `insulin-index-explorer`. The empty `.nojekyll`
file tells GitHub Pages to serve the files as they are.

## Preview on your computer

The site loads its data with `fetch`, which browsers block when you open `index.html` directly
from your files. Serve the folder instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Update the data

`data/mmc1_insulinaemic_index.csv` is the source of truth. `data/foods.json` is generated from it.

1. Edit or replace `data/mmc1_insulinaemic_index.csv`. Keep the same 12 column headings.
2. Rebuild the JSON and run the checks:

   ```bash
   python3 scripts/build_foods.py
   ```

   Every line should say `PASS`. The script exits with an error if a check fails.
   `python3 scripts/build_foods.py --check` runs the checks without writing the file.
3. Open the site's **Data check** page (`#/admin`) and compare the rows against the paper's PDF.
4. Commit both the CSV and `data/foods.json`.

Notes:

- **Values are never changed.** Food names, II values and study names are copied through exactly as
  published. The script only adds helper fields for the site: `group`, `ref`, `iiValue` and `searchKey`.
- **The expected counts are written into the checks** (629 foods, II sum 42429.12 and so on, in
  `scripts/build_foods.py` and `assets/js/admin.js`). If you load a new edition of the table, update
  those numbers to match the new paper.
- **A new category** has to be added to a site group in `GROUPS` at the top of
  `scripts/build_foods.py`, or the script stops and tells you which one.
- **No low/high bands.** The paper gives no agreed clinical cut-off, so the site shows each II as
  published, without labels, traffic-light colours or reference marks.
- **The reference tag** is "vs bread" when the comparator mentions bread, otherwise "vs glucose".
- `data/mmc2_insulinaemic_index.csv` (Supplemental Table 2: 124 foods from 31 studies that did not
  meet the paper's main criteria) is kept for reference only. The site never loads it.

## Food photos

Each single food shows a photo of its **type of food** (for example "rye bread"), never a claim
that it is the exact product tested. Mixed meals, and a few single foods where any photo would
mislead (lab drinks, powders, sorghum breads), show a plain plate outline instead.

- `data/photo_map.csv` lists every food (Number, name) and its photo type. Blank = no photo.
  Edit it in Excel to change which photo a food uses.
- `data/photo_types.csv` lists each photo type with what it shows, its file and its credit
  (title, author, licence, source). All food photos are openly licensed: CC BY, CC BY-SA, CC0 or
  public domain. Credits appear on the About page and under the photo on each food.
- The image files are `assets/img/foods/<type>.jpg` (800×600) and
  `assets/img/foods/thumb/<type>.jpg` (240×240).

To add or replace a photo: put both image sizes in those folders, add or edit the row in
`data/photo_types.csv` (keep the credit and licence exactly as the source gives them), point the
foods at it in `data/photo_map.csv`, then run `python3 scripts/build_foods.py`. The check
"photo types still without a photo" should be 0. The Data check page's "Site columns" view shows
every food's photo, so the matches can be reviewed in one list.

## Data check (admin) page

`#/admin` is for checking the database against the paper without opening 629 cards:

- the whole table in the PDF's column order, grouped by category and sub-category, with PDF page
  numbers
- automated checks (counts, II sum, reference foods, numbering, category order)
- "Worth a look" flags for likely copy slips, such as a hyphen followed by a space from a PDF line
  break or unbalanced brackets. These are shown as published, never fixed.
- tick rows as checked, flag them with a note, or tick a whole category; keyboard shortcuts
  J/K (move), X (tick), F (flag), / (search)
- export the review as CSV, back it up or restore it as JSON, or print it

Ticks and notes are saved in that browser only. The page has no login: anyone with the link can
open it, but it cannot change the data.

## Files

```
index.html               page shell, header, footer, dialogs
assets/css/styles.css    all styles
assets/js/app.js         data loading and hash routing
assets/js/ui.js          shared pieces: cards, badges, detail panel, compare
assets/js/home.js        Home
assets/js/explorer.js    Food Explorer
assets/js/groups.js      Food groups
assets/js/collection.js  Lowest-II picks and Mixed meals
assets/js/guide.js       How to read the II
assets/js/about.js       About & sources
assets/js/admin.js       Data check (admin)
data/                    source CSVs, photo map and credits, and the generated foods.json
assets/img/foods/        food photos (800×600) and thumb/ (240×240)
scripts/build_foods.py   CSV → foods.json, plus the data checks
```

## Credits and licence

- **Data:** Hendricks et al., 2024, used under
  [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): shown unchanged, with
  attribution, for non-commercial education.
- **Banner photos:** [Pexels](https://www.pexels.com). If one can't load, the site shows a soft
  gradient instead, so a broken image never appears.
- **Food photos:** openly licensed photos found through [Openverse](https://openverse.org), mostly
  from Flickr. Each is credited on the About page and under the photo.
- **Fonts:** Fraunces and Plus Jakarta Sans, from Google Fonts.
