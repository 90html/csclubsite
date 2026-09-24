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
| Change email, meeting schedule/room, calendar, points, socials | `config.js` (every setting is commented) |
| Update school holidays for a new year | `data/school-calendar.json` |
| Add a meeting's slides | `data/slides.json` |
| Change officers next year | `data/officers.json` |
| Add photos | `assets/images/originals/`, then run `npm run images` |

**Tip:** add `?setup` to any page's URL (for example `…/points/?setup`) to see a checklist of the placeholders that are still unfilled.

While a setting is empty or a placeholder (`PASTE_…`), the site keeps working and simply hides that piece. For example, the Points leaderboard shows "coming soon" until a sheet is connected.

---

## 1. Points

The points rules ("How points work": the 7-point EOS goal and the ways to earn) live in `points/index.html`. Edit that text directly. The goal number is `POINTS.EOS_GOAL` in `config.js`.

The **leaderboard is off for now** (last year's sheet was disconnected), so the page shows "coming soon". To turn it on with a new sheet:

1. In the spreadsheet, row 1 should hold headers such as **Name, Meetings, Problems, Contests, Total**. Total is optional: if it's missing, the other columns are added together.
2. Click **File → Share → Publish to web**, choose the points tab and **Comma-separated values (.csv)**, click **Publish**, and copy the link.
3. Paste it into `config.js` as `POINTS.POINTS_SHEET_URL`. The `pubhtml` embed link works too.
4. If your headers are named differently, change `POINTS.COLUMNS`. For one column per meeting date, use `POINTS.COLUMN_GROUPS`.

> ⚠️ **Privacy:** a published sheet is **public**. Use **first name + last initial**, and never publish IDs, emails or grades. The site never logs or sends searched names anywhere.

## 2. Calendar

The Calendar page, the "Next meeting" countdown and the Home "Next up" strip combine three things:

| Source | Where it's set |
|---|---|
| **Club meetings:** every other Monday, 3:00–3:45 PM, Room B105 | `config.js` → `MEETING` and `MEETING.SCHEDULE` |
| **School calendar:** FBISD holidays, breaks, exams | `data/school-calendar.json` (**update every school year**) |
| **MSA events:** MSA meetings and socials | the MSA master calendar (`CALENDAR.MSA_CALENDAR_ID`) |

**Meeting rules:** a club meeting that lands on a no-school day, or on a day with an MSA meeting or social, moves to the next Monday. If that Monday is blocked too (or is already a meeting), it's canceled and shown as "No club meeting". Other clubs' events on the MSA calendar are ignored (`CALENDAR.MSA_IGNORE`). Only August 2026 to May 2027 can be viewed (`CALENDAR.RANGE`).

**To change the schedule:** edit `MEETING.SCHEDULE.firstMeeting` (any meeting date in the pattern) and `everyWeeks`. Add one-off meetings to `extraMeetings`.

**API key:** the key in `CALENDAR.CALENDAR_API_KEY` is a browser key, so anyone can see it in the page source. Lock it down in Google Cloud Console → **APIs & Services → Credentials** → the key:
- **Application restrictions → Websites:** add `https://90html.github.io/*` (plus your custom domain and `http://localhost:8080/*` for testing).
- **API restrictions → Restrict key → Google Calendar API.**

**If the club makes its own Google Calendar later:** make it public, then paste its Calendar ID (Calendar settings → Integrate calendar) into `CALENDAR.CALENDAR_ID`. Club events then come from it instead of the schedule, with colors picked by keywords in `CALENDAR.EVENT_TYPES`.

## 3. Slides: add a meeting

Open `data/slides.json` and add one object to the `slides` list:

```json
{
  "id": "2026-10-19",
  "title": "Recursion",
  "date": "2026-10-19",
  "tags": ["Java", "Intermediate"],
  "description": "Functions that call themselves, plus classic contest problems.",
  "coverImage": "",
  "slidesUrl": "",
  "availableFrom": ""
}
```

- `title`, `tags` and `description` are optional. An untitled card shows "Club Meeting".
- **Before the meeting:** leave `slidesUrl` empty. The card shows **"Available after the meeting"** with a lock.
- **After the meeting:** paste the link to the Google Slides deck (**Share → Anyone with the link → Viewer**) into `slidesUrl`. The card unlocks by itself.
- The unlock time is the meeting `date` at `MEETING.endTime24` (in `MEETING.timezone`). Set `availableFrom` (e.g. `"2026-10-08T17:30:00-05:00"`) to override it.
- **Cover image (optional):** without one, the site generates a cover. To use your own, put an image in `assets/slides/originals/`, run `npm run images`, then set `"coverImage": "assets/slides/<file-name>.webp"`.

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
