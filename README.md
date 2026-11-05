# Insulin Index Explorer

A fast, friendly website for searching and exploring the **insulin index (II) of 629 foods**, using
Supplemental Table 1 of:

> Hendricks SA, Paul MJ, Subramaniam Y, Vijayam B. A collectanea of food insulinaemic index: 2023.
> *Clinical Nutrition ESPEN*. 2024;63:92–104. https://doi.org/10.1016/j.clnesp.2024.06.017
> Open access, CC BY-NC-ND 4.0. Funded by Newcastle University Medicine Malaysia (NUMed).

Plain HTML, CSS and JavaScript. No build step, no backend, no framework. It runs on GitHub Pages.

## Admin guide

For team members who look after the website. The everyday jobs need no coding.

### 1. Sign in

1. Open the website, scroll to the bottom and click **Admin login** (or add `#/admin` to the address).
2. Type the team's admin username and password. Ask the site owner; they are deliberately not
   written anywhere in this repository.
3. Tick **Keep me signed in** only on your own computer.

The Admin area has four tabs. **Admin guide ↗** next to your name opens this page.

| Tab | Use it to |
|---|---|
| **Data check** | check the website's table against the paper's PDF, row by row |
| **Photos** | add, replace or remove food photos, their credits, and which foods use them |
| **Activity** | see everything published to the website: what, when and by whom |
| **Visitors** | see how many visits the website and each page have had |

### 2. Add or change a food photo

1. **Photos** tab → **+ Add a photo**, or click an existing photo to edit or replace it.
2. Upload or drag in the image and adjust the crop. The browser resizes it and removes location
   and camera data.
3. Fill in the credit: what it shows, author, licence and source link. Only use photos whose
   licence allows a public website (CC BY, CC BY-SA, CC0, public domain, the Pexels, Pixabay or
   Unsplash licence) or the team's own photos.
4. Choose which foods use it, by Table 1 number or name. A photo shows the **type** of food
   (for example "rye bread"), never the exact product tested.
5. Check the preview on the site (only you see it), type a short note saying why, then press
   **Publish to website**. The live site updates about a minute later, and Activity records it.

The first time you publish on a device, the site asks you to **connect GitHub** (step 3).

### 3. Connect GitHub (once per device, only needed to publish)

1. The site owner adds your GitHub account as a collaborator (repository Settings → Collaborators).
2. Create a fine-grained access token (the Connect dialog links straight there):
   Resource owner = the repository's owner; Repository access = only this repository;
   Permissions → Contents: **Read and write**.
3. Paste it into the Connect dialog. It is remembered on that device only and sent only to GitHub.
   On a shared computer, untick **Remember on this device**, or press **Disconnect GitHub** afterwards.

### 4. Check the data against the paper

**Data check** shows Table 1 in the PDF's order with PDF page numbers, automated checks, and
"Worth a look" flags for likely copy slips. Tick rows as you check them, flag a row with a note,
and use **Export review (CSV)** to share your progress. Ticks are saved in that browser only.

### 5. Visitor counts

**Visitors** shows visits for all time, the last 30 days or the last 7 days, in total and per page.
Countries, referrers and devices are on the full GoatCounter dashboard (**Open full dashboard ↗**;
sign in with the team's GoatCounter account).

### 6. Problems reported by visitors

Every food has **Report a problem with this entry**. It opens an email to `reportEmail` (see
Settings below) with the food's number, name, II and study filled in. Check it against the PDF
in Data check. A value that matches the paper stays as it is, even if it looks odd.

### 7. Ground rules

- II values, food names and study names are always shown **exactly as published**.
- No low/high labels, colours or cut-offs: the paper gives none.
- Never write a password or token into any file.

### Site settings (`assets/js/config.js`)

Edit the file on GitHub (pencil icon), then **Commit changes**. The site updates in about a minute.

| Setting | What it does |
|---|---|
| `version` | the "Website vX" in the footer; match the GitHub release |
| `dataSource` | the data line in the footer |
| `url` | the public address, used in report emails |
| `reportEmail` | where "Report a problem" emails go; empty hides the link |
| `goatcounter` | the GoatCounter code; empty turns visitor counting off |
| `countFrom` | the Visitors tab counts from this date, e.g. `'2026-12-01'` |
| `countOnlyOn` | the addresses whose visits are counted |

### Release a new version

1. Set `version` in `assets/js/config.js` (for example `'3.0'`) and commit.
2. On GitHub: **Releases → Draft a new release**, tag `v3.0`, choose the website's branch, write
   what changed, **Publish release**. Each release is a snapshot you can go back to.

### Before the public launch

- Change the admin password: `python3 scripts/set_admin_login.py`, then commit `assets/js/admin.js`.
- Visitor counting is already set for launch: only `insulinindexresearch.com` is counted, from 2026-11-05.
  To test counting on another address, add it to `countOnlyOn` in `config.js`.
- Ask fluent speakers to check `data/translations.csv` (Malay, Chinese and Tamil).
- GoatCounter → Settings → **Dashboard viewable by**: only logged-in users.
- For the custom domain, update `url` in `config.js` and the link-preview addresses at the top of `index.html`.

---

The rest of this file is for whoever maintains the code.

## Pages

| Page | Address | What it does |
|---|---|---|
| Home | `#/` | Search, quick stats, food groups, badge legend, section tiles |
| Food Explorer | `#/explorer` | Instant search, filters, sort, detail panel, compare up to 3, report a problem |
| Food groups | `#/groups` | 14 groups with counts, II range and a dot strip of every food |
| Single foods | `#/lowest` | All 469 single foods ranked by II (lowest first), separately for glucose and bread |
| Mixed meals | `#/mixed` | All 160 mixed meals |
| How to read the II | `#/guide` | What the II means, II vs GI, comparing like with like, median chart |
| About & sources | `#/about` | Citation, methods, footnotes, limitations, licence |
| Admin (sign-in) | `#/admin` | Data check, Photos, Activity and Visitors (see the Admin guide above) |

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
- **The comparator tag** is "Comparator: bread" when the comparator mentions bread, otherwise "Comparator: glucose".
- `data/mmc2_insulinaemic_index.csv` (Supplemental Table 2: 124 foods from 31 studies that did not
  meet the paper's main criteria) is kept for reference only. The site never loads it.

## Food photos

Each food can show a photo of its **type of food** (for example "rye bread"), never a claim that it
is the exact product tested. Foods without a photo, including all mixed meals for now, show a
plain plate outline.

**Manage photos on the Admin page** (`#/admin`, Photos tab): add a photo, replace an image, edit
its credit, remove it, and choose which foods use it. The browser crops and resizes each upload
(800×600 and 240×240 JPEG, with location and camera data removed). Changes are previewed across
the site in your tab first; **Publish to website** saves them to GitHub in one commit, and the
live site updates about a minute later.

Behind the scenes:

- `data/photos.json` holds every photo: `types` (photo id → what it shows and its credit) and
  `map` (Table 1 Number → photo id). `v` changes when an image is replaced so browsers fetch the
  new one.
- Images live at `assets/img/foods/<id>.jpg` and `assets/img/foods/thumb/<id>.jpg`.
- Only use photos whose licence allows a public website (CC BY, CC BY-SA, CC0, public domain) or
  your team's own photos, and fill in the credit. Credits appear under each photo and on the
  About page.
- `python3 scripts/build_foods.py` checks that every photo in `data/photos.json` has both image
  files and points at real foods.

## Admin page and sign-in

Open the Admin page from **Admin login** in the footer, or add `#/admin` to the site address.

**Sign in** with the team's admin username and password (ask the site owner; they're
deliberately not written in this repository). This opens the four admin tabs.

**Publishing photo changes** also needs a GitHub connection, asked for once per device the first
time someone presses Publish:

1. The repository owner adds the person's GitHub account as a collaborator (repository
   Settings → Collaborators).
2. That person creates a fine-grained access token (the Connect dialog links straight there):
   Resource owner = the repository's owner; Repository access = only this repository;
   Permissions → Contents: Read and write.
3. They paste it into the Connect dialog. It's remembered on that device (untick on shared
   computers) and sent only to GitHub.

To lock someone out, remove them as a collaborator or delete their token on GitHub.

Why two steps: a website with no server can't keep a password secret (anyone determined can read
the page's code), so the username and password are a light lock on the admin screens. The power
to change the live site is protected by GitHub itself.

**Change the login:** run `python3 scripts/set_admin_login.py`, then commit and push
`assets/js/admin.js`. Only a hash of the username and password is stored, never the password.

**If the repository is renamed or moved** (for example when setting up the custom domain),
either update `DEFAULT_REPO` at the top of `assets/js/github.js`, or open "Repository settings" in
the Connect dialog and type the new owner and name.

### Activity tab

A logbook of everything published to the website, newest first, read from the repository's
GitHub history: who published (their GitHub account, plus the admin login they used), when, what
changed (photos added, replaced or removed, and which food numbers), and the optional note typed
next to Publish. "Details" shows the photos involved; "View on GitHub" opens the full change.
Sign-ins and Data check ticks aren't recorded, because the site has no server.

### Visitors tab

Shows how many visits the public website has had (all time, last 30 days, last 7 days), in total
and page by page, from GoatCounter. It needs one setting, once: in GoatCounter go to
**Settings**, tick **“Allow adding visitor counts on your website”** and save. Countries,
browsers and referrers are on the full GoatCounter dashboard, linked from the tab.

**Starting fresh at launch:** set `countFrom` in `assets/js/config.js` to the launch date (for
example `'2026-12-01'`). The tab then only counts visits from that day, so test visits disappear
from it. Nothing is deleted on GoatCounter, so it can be undone. (To really delete visits, use
GoatCounter's own Settings → Manage pageviews.)

### Data check tab

The Data check tab is for checking the database against the paper without opening 629 cards:

- the whole table in the PDF's column order, grouped by category and sub-category, with PDF page
  numbers
- automated checks (counts, II sum, reference foods, numbering, category order)
- "Worth a look" flags for likely copy slips, such as a hyphen followed by a space from a PDF line
  break or unbalanced brackets. These are shown as published, never fixed.
- tick rows as checked, flag them with a note, or tick a whole category; keyboard shortcuts
  J/K (move), X (tick), F (flag), / (search)
- export the review as CSV, back it up or restore it as JSON, or print it

Ticks and notes are saved in that browser only.

## Languages: English, Bahasa Melayu, 中文, தமிழ்

The language menu in the header (**EN / BM / 中文 / TA**) switches the language; the choice is
remembered on that device. The translations are in `data/translations.csv`, four columns:
`English`, `Bahasa Melayu`, `中文` (Simplified Chinese) and `தமிழ்` (Tamil). Open it in Excel or Google Sheets, correct a
column, save as **CSV UTF-8** and push. Anything not in the sheet stays in English.

- `{n}` stands for a number and `{x}` for any text, e.g. `Show {n} foods` → `Papar {n} makanan`.
  Keep these markers in the translated columns.
- Food names, categories, portions, studies, countries and comparators stay in English, exactly
  as published, and so do direct quotes from the paper (the translation adds a short gloss).
- The Admin page stays in English.
- The Malay, Chinese and Tamil were written by Claude and should be checked by fluent speakers
  (a language expert for Tamil) before launch.

## Files

```
index.html               page shell, header, footer, dialogs
assets/css/styles.css    all styles
assets/js/app.js         data loading and hash routing
assets/js/ui.js          shared pieces: cards, badges, detail panel, compare
assets/js/home.js        Home
assets/js/explorer.js    Food Explorer
assets/js/groups.js      Food groups
assets/js/collection.js  Single foods and Mixed meals
assets/js/guide.js       How to read the II
assets/js/about.js       About & sources
assets/js/admin.js       Admin: sign-in and Data check
assets/js/admin-photos.js  Admin: Photos (upload, credits, which foods use which photo)
assets/js/admin-visitors.js  Admin: Visitors (GoatCounter counts)
assets/js/github.js      GitHub sign-in and publishing for the Admin page
assets/js/i18n.js        language switch (reads data/translations.csv)
data/                    source CSVs, photos.json (photos and credits), generated foods.json
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
