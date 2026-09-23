# Dulles Computer Science Club website

A fast, dark-themed static website for the Dulles High School CS Club. It uses plain HTML, CSS and JavaScript with **no framework and no build step required** to run it. It works on GitHub Pages, Netlify, Vercel or any static host, and can also be pasted into Weebly (see **[SETUP_GUIDE.md](SETUP_GUIDE.md)**).

| Page | What it does |
|---|---|
| **Home** | Hero, what we do, next meeting (live countdown), latest slides, points lookup, photo gallery (once photos are added) |
| **Getting Started** | 4-step path, plus curated Java setup / learning / practice links |
| **Slides** | One card per meeting. Cards unlock automatically after the meeting. Search, topic filter, sort |
| **Calendar** | Custom month and agenda views over your Google Calendar, with event details, "Add to Google Calendar" and `.ics` download |
| **Points** | Name search (typo-tolerant), animated result card, rank, sortable leaderboard. Data comes from a Google Sheet |
| **Officers** | Officer and sponsor cards from `data/officers.json` |
| **Contact** | One-click copy of the club email, sponsor rooms, meeting info |

---

## Quick start: what to edit

| I want to… | Edit this |
|---|---|
| Change email, meeting time, calendar, points sheet, point values, socials | `config.js` (every setting is commented) |
| Add a meeting's slides | `data/slides.json` |
| Change officers next year | `data/officers.json` |
| Add photos | `assets/images/originals/`, then run `npm run images` |

**Tip:** add `?setup` to any page's URL (for example `…/points/?setup`) to see a checklist of the placeholders that are still unfilled.

While a setting is still a placeholder (`PASTE_…`), the site keeps working. The Calendar and Points pages show clearly labelled **DEMO** data, and unfilled facts such as the meeting time are simply hidden.

---

## 1. Points: publish the Google Sheet

1. Open the points spreadsheet. Row 1 should hold headers such as **Name, Meetings, Problems, Contests, Total**. Total is optional: if it's missing, the site adds the other columns together.
2. Click **File → Share → Publish to web**.
3. Under **Link**, choose the tab with the points (not "Entire document"), then choose **Comma-separated values (.csv)**.
4. Click **Publish**, confirm, and copy the link. It looks like `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv`.
5. Paste it into `config.js` as `POINTS_SHEET_URL`.
6. If your headers are named differently, change `POINTS.COLUMNS`. The site also tries to auto-detect common names ("Student", "Attendance", "Solved", "Score").
7. **One column per meeting date?** List them in `POINTS.COLUMN_GROUPS`, for example `meetings: ['9/*', '10/*']`, and they're added together.
8. Set the point values in `POINTS.POINT_VALUES`. These are shown in "How points work".

Edits to the sheet appear on the site within about 5 minutes (Google caches published sheets). The page also auto-refreshes.

> ⚠️ **Privacy:** anything you publish to the web is **public**. Anyone with the link can see the whole sheet. Use **first name + last initial** (e.g. "Ava M."), and never put student IDs, emails, grades or other personal information in the published tab. The website itself never logs or sends searched names anywhere, and has no analytics.

## 2. Calendar: make it public and get an API key

The site reads your Google Calendar with the Calendar API. It doesn't use Google's iframe, and Google's ICS feed can't be read by browsers directly.

**Make the calendar public**
1. In Google Calendar, click **⚙ Settings**, then pick your club calendar under **Settings for my calendars**.
2. Under **Access permissions for events**, tick **Make available to public** and choose **See all event details**.
3. Scroll to **Integrate calendar** and copy the **Calendar ID** (for example `abc123@group.calendar.google.com`). Paste it into `config.js` as `CALENDAR_ID`.

**Create a free API key**
1. Go to <https://console.cloud.google.com/> and create a project (for example "DHS CS Club site").
2. Open **APIs & Services → Library**, search **Google Calendar API** and click **Enable**.
3. Open **APIs & Services → Credentials → Create credentials → API key**.
4. Click the new key to restrict it:
   - **Application restrictions → Websites.** Add every address the site runs on, for example:
     `https://90html.github.io/*`, your custom domain `https://yourdomain.org/*`, `https://dhscompsci.weebly.com/*` (only if you use the Weebly embeds), and `http://localhost:8080/*` for testing.
   - **API restrictions → Restrict key → Google Calendar API.**
5. Paste the key into `config.js` as `CALENDAR_API_KEY`.

A browser API key is visible to visitors by design. The website restriction is what stops anyone else from using it, and it can only read public calendars.

**Event colors** come from keywords in the event title (Meeting, Contest, Workshop, Social). You can change them in `CALENDAR.EVENT_TYPES`.

## 3. Slides: add a meeting

Open `data/slides.json` and add one object to the `slides` list:

```json
{
  "id": "2026-10-08-recursion",
  "title": "Recursion",
  "date": "2026-10-08",
  "tags": ["Java", "Intermediate"],
  "description": "Functions that call themselves, plus classic contest problems.",
  "coverImage": "",
  "slidesUrl": "",
  "availableFrom": ""
}
```

- **Before the meeting:** leave `slidesUrl` empty. The card shows **"Available after the meeting"** with a lock.
- **After the meeting:** paste the link to the Google Slides deck (**Share → Anyone with the link → Viewer**) into `slidesUrl`. The card unlocks by itself.
- The unlock time is the meeting `date` at `MEETING.endTime24` (in `MEETING.timezone`). Set `availableFrom` (e.g. `"2026-10-08T17:30:00-05:00"`) to override it.
- **Cover image (optional):** without one, the site generates a cover. To use your own, put an image in `assets/slides/originals/`, run `npm run images`, then set `"coverImage": "assets/slides/<file-name>.webp"`.
- Entries marked `"placeholder": true` are **sample cards**. Delete them once real meetings are in.

Watch the commas: every object except the last one in the list needs a `,` after its `}`.

## 4. Officers: next year's roster

Edit `data/officers.json`. The groups display in order, and `"featured": true` gives a group large cards (the President). To add a photo, put a square image in `assets/images/officers/` and set `"photo": "assets/images/officers/name.webp"`. Leave it `""` to show initials.

## 5. Photos ("Moments" gallery)

1. Copy photos into `assets/images/originals/`.
2. Run `npm install` (first time only), then `npm run images`. This creates optimized WebP files at three sizes and fills in `data/gallery.json`.
3. Open `data/gallery.json` and replace each `"TODO: describe this photo"` with real alt text, such as "Members solving problems at a practice contest".

The gallery appears on the Home page automatically.

---

## Deploying

### GitHub Pages (recommended; the site is already in this repo)
1. On GitHub, open the repository, then **Settings → Pages**.
2. Under **Build and deployment**, choose **Source: Deploy from a branch**, **Branch: `main`**, **Folder: `/ (root)`**, then **Save**. (This work is on the `claude/dulles-cs-club-website-njv2x3` branch, so merge it into `main` first, or pick that branch here.)
3. After a minute the site is live at `https://90html.github.io/csclubsite/`.
4. That URL is already set as `SITE_URL` in `config.js`. If it changes, update it and run `npm run build`, which refreshes share previews, the sitemap and the Weebly export.

### Netlify
1. Go to <https://app.netlify.com/drop> and drag the whole project folder onto the page. Or connect the GitHub repo, leaving the build command empty and setting the publish directory to `/`.
2. Copy the `*.netlify.app` URL into `SITE_URL` and run `npm run build`.

### Custom domain
- **GitHub Pages:** **Settings → Pages → Custom domain** → enter `www.yourdomain.org` → Save → tick **Enforce HTTPS** once it's available. At your domain registrar, add:
  - `CNAME` record: `www` → `90html.github.io`
  - For the bare domain (`yourdomain.org`), four `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- **Netlify:** **Domain management → Add a domain** and follow the DNS instructions it shows.
- Then set `SITE_URL` to the new address and run `npm run build`.
- Moving a domain that's currently connected to Weebly is covered in [SETUP_GUIDE.md](SETUP_GUIDE.md).

---

## For developers

```bash
npm install        # dev tools only (esbuild, sharp, playwright-core); the site itself has no dependencies
npm run serve      # http://localhost:8080 (gzip, like real hosting)
npm run build      # sync header/footer/<head> across pages, pre-render officers, sitemap, Weebly export
npm test           # end-to-end checks in headless Chrome
npm run images     # optimize gallery photos + slide covers
npm run brand      # regenerate favicons + social share image
```

```
config.js              ← every editable setting
data/                  ← slides.json, officers.json, gallery.json
css/site.css           ← design tokens + all components
js/core/               ← app shell (nav, reveal, modal, embed support, helpers)
js/lib/                ← calendar, points (CSV + fuzzy search), slides, ICS, sanitizer
js/pages/              ← one small entry script per page
assets/                ← fonts (self-hosted), icons, OG image, photos, slide covers
tools/                 ← build, test, images, brand, dev server
weebly-export/         ← generated: paste-ready pages for Weebly (see SETUP_GUIDE.md)
```

- **When to run `npm run build`:** after changing `SITE_URL`, page titles or descriptions (`tools/partials.mjs`), the nav, or the header/footer. Also run it before re-pasting into Weebly. Day-to-day edits to `config.js` and `data/*.json` go live without a build.
- **Shared page chrome** lives between `<!-- @head -->`, `<!-- @header -->` and `<!-- @footer -->` markers in each page, and is generated from `tools/partials.mjs`.
- **Accessibility:** includes a skip link, landmarks, visible focus rings, a native `<dialog>` modal, an ARIA combobox for name search, ARIA tabs for the calendar views, and an inert background behind the mobile drawer. `prefers-reduced-motion` is respected.
- **Performance:** the site uses self-hosted variable fonts (Latin subset, preloaded), no frameworks, no layout shift, and lazy-loaded images. Local Lighthouse (mobile) scores are 99 / 100 / 100 / 100 across all pages.
