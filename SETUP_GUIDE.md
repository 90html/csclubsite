# Setup guide: getting the new site live

Your club's site is on Weebly today (`dhscompsci.weebly.com`). Weebly can't host a normal multi-file website, so there are two ways to go live.

| | **Option A: Host it free, link Weebly to it** ⭐ recommended | **Option B: Keep everything inside Weebly** |
|---|---|---|
| How | The site lives on GitHub Pages or Netlify. Weebly points or links to it. | Each page is pasted into a Weebly "Embed Code" element. |
| Speed | Fastest (Lighthouse 99/100/100/100) | Slower (Weebly loads its own theme first) |
| Updating slides/officers | Edit a JSON file. Live in about a minute. | Edit the JSON, rebuild, re-paste. Or combine with A so the embeds pull live data. |
| Clean URLs, SEO, share previews | ✅ | Partly (Weebly controls the page `<head>`) |
| Cost | Free (a custom domain costs about $10–15/yr, optional) | Free on Weebly's free plan (with Weebly's ad banner). A custom domain needs a paid Weebly plan. |

**Recommendation: Option A.** You get the full-quality site, and updating it is as simple as editing a file on GitHub. You can keep Weebly around as a pointer to it.

---

## Option A: host on GitHub Pages (or Netlify)

### A1. Put the site online

**GitHub Pages** (the code is already in the `90html/csclubsite` repository):
1. On GitHub, open the repo, then **Settings → Pages**.
2. **Source: Deploy from a branch.** Pick the branch that holds this site (merge `claude/dulles-cs-club-website-njv2x3` into `main` first, or select it directly) and the folder **`/ (root)`**. Click **Save**.
3. Wait about a minute. Your site is at **`https://90html.github.io/csclubsite/`**.
   - GitHub Pages is free for **public** repositories. A private repo needs a paid GitHub plan, or use Netlify.

**Netlify** (drag and drop, no GitHub needed):
1. Go to <https://app.netlify.com/drop> and log in.
2. Drag the project folder onto the page. If a `node_modules` folder exists, leave it out; the site doesn't need it.
3. You get a URL like `https://dhs-cs-club.netlify.app`. Use **Site settings → Change site name** to pick a nicer one.

Then open `config.js`, set `SITE_URL` to your live address (no trailing slash), and run `npm run build`. For a GitHub-hosted site, you can also just ask whoever maintains it to do this.

### A2. Send Weebly visitors to the new site

Pick one:

**(1) Point your custom domain at the new site (best, if the club owns a domain like `dhscompsci.org`).**
- *Domain bought somewhere else* (Namecheap, GoDaddy, Google/Squarespace Domains…): log in there and edit the DNS records:
  - GitHub Pages: `CNAME` `www` → `90html.github.io`, plus four `A` records for the bare domain: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Then on GitHub go to **Settings → Pages → Custom domain**, enter `www.yourdomain.org` and tick **Enforce HTTPS**.
  - Netlify: **Domain management → Add a domain**, then copy the records Netlify shows.
  - Then **disconnect the domain in Weebly**: **Settings → Domain** (in the Weebly/Square editor), then remove or unlink the custom domain, so Weebly stops claiming it.
- *Domain bought through Weebly/Square:* its DNS lives in your Weebly/Square account, usually under **Settings → Domain → Manage** (sometimes called **Advanced DNS**). Add the same `CNAME`/`A` records there. The exact menu names change often; if you can't find them, Square support can transfer the domain out or edit DNS for you.
- DNS changes take anywhere from a few minutes to 24 hours.
- Finally, set `SITE_URL` in `config.js` to `https://www.yourdomain.org` and run `npm run build`.

**(2) No custom domain? Use `dhscompsci.weebly.com` as a front door.** A `*.weebly.com` address can't be pointed elsewhere, so choose one of:
- **Link:** replace the Weebly home page content with one big button, "Our new website →", linking to the new URL.
- **Redirect:** Weebly doesn't offer true server redirects on the free plan. The closest option is a small Embed Code element on the home page containing
  `<script>window.top.location.href = "https://90html.github.io/csclubsite/";</script>`
  This runs on the **published** site, not in the editor, and sends visitors straight to the new site.
- **Full-width iframe:** show the hosted site inside Weebly. Open `weebly-export/iframe-hosted-site.html`, copy the block for a page, and paste it into an **Embed Code** element on the matching Weebly page. It resizes itself to fit the content, so there's no double scrollbar.

### A3. Updating the site later (Option A)

On GitHub you can edit files right in the browser: open the file and click the ✏️ pencil icon, make your change, then **Commit changes**. The site updates in about a minute.

- **After a meeting, add the slides link:** open `data/slides.json`, find that meeting and paste the Google Slides link into `"slidesUrl"`. Plan ahead by adding next week's entry with an empty link; it shows as locked until the meeting ends.
- **New officers next year:** edit the names in `data/officers.json`.
- **Meeting time, email, point values:** edit `config.js`.
- **Points:** just edit the Google Sheet. The site picks up changes on its own.
- **Calendar:** just edit Google Calendar. The site picks up changes on its own.

---

## Option B: keep everything inside Weebly

`weebly-export/` holds one paste-ready file per page:

| File | Paste on Weebly page |
|---|---|
| `1-home.html` | Home |
| `2-getting-started.html` | Getting Started |
| `3-slides.html` | Slides (new page) |
| `4-calendar.html` | Calendar (new page) |
| `5-points.html` | Points (new page) |
| `6-officers.html` | Officers |
| `7-contact.html` | Contact Us |

Each file is self-contained: all CSS, JavaScript and data are inside it, and images use absolute URLs. It renders inside its own frame, so Weebly's theme can't break its styles, and it **resizes itself** to fit its content.

### B1. Before pasting
1. In `config.js`, check `WEEBLY_PAGE_URLS`. These are the Weebly addresses the in-page nav links to. The defaults match the page names below.
2. If the site is **not** also hosted (you skipped Option A), set `EMBED_FETCH_LIVE_DATA: false`.
3. Want Weebly's navigation instead of the site's own navbar and footer? Set `EMBED_SHOW_HEADER_FOOTER: false`.
4. Run `npm run build` to regenerate `weebly-export/`.

### B2. Set up the pages in Weebly
1. In the Weebly editor, open **Pages**.
2. **Delete** the old pages: **Java Materials**, **Misc Links**, **Announcements** (the blog).
3. **Add** three new Standard Pages: **Slides**, **Calendar**, **Points**. Check each page's URL in its page settings (for example `slides.html`) matches `WEEBLY_PAGE_URLS`.
4. Put the pages in this order: Home, Getting Started, Slides, Calendar, Points, Officers, Contact Us.
5. For each page, choose **Header type → No Header** (or the smallest header) in the page settings, so the embed starts right below the menu.

### B3. Paste each page
For each page:
1. Delete the old content blocks on the page.
2. Drag an **Embed Code** element (under **Basic** in Weebly's element list) onto the page, full width.
3. Click it, then **Edit Custom HTML**, and paste the **entire** contents of the matching file from `weebly-export/`.
4. Click outside the element. In the editor it may look blank or show a placeholder, because **scripts only run on the published site**.
5. You don't need to set a height: the embed sets its own height automatically. If your theme adds padding around elements, set the section to full width or zero padding if the option exists.

When all seven are done, click **Publish** and check each page on the live site, on your phone as well.

### B4. What's limited on Weebly (so you're not surprised)
- **Custom code:** the Embed Code element (HTML + JavaScript) is available on Weebly's plans, including free, as of this writing. Weebly/Square changes plan features from time to time, so test one page first. The code only runs on the **published** site; the editor preview stays blank.
- **Weebly's own header, menu and footer remain.** You can hide the header image per page (No Header), but the menu bar and, on the free plan, the "Powered by Weebly/Square" footer banner stay. Removing the banner or connecting a custom domain needs a paid plan. You can hide the embed's duplicate nav with `EMBED_SHOW_HEADER_FOOTER: false`.
- **SEO and share previews** come from Weebly's page settings (title and description per page), not from the embed. Copy the titles and descriptions from `tools/partials.mjs` into each page's **SEO Settings**.
- **Speed:** each page loads Weebly's theme first, then the embed, so it's slower than Option A.
- **Size:** each file is about 95–120 KB. That's fine for Weebly, but if the editor ever refuses the paste, use the iframe option from A2 instead.
- **API key restriction:** add `https://dhscompsci.weebly.com/*` to the Google Calendar API key's allowed websites (README → Calendar).
- **Updates need a re-paste:** after editing `config.js` or `data/*.json`, run `npm run build` and paste the new file for that page. **Shortcut:** also host the site (Option A) and keep `EMBED_FETCH_LIVE_DATA: true`. The embeds then load the latest `slides.json` and `officers.json` from the hosted site, so slides and officer changes show up without re-pasting. Points and Calendar are always live either way, because they read Google directly.

### B5. Updating the site later (Option B)
- **Slides link after a meeting:** edit `data/slides.json`, run `npm run build`, then re-paste `3-slides.html` and `1-home.html` (Home shows the latest slides). With the "Shortcut" above, just edit the JSON on GitHub.
- **Officers next year:** edit `data/officers.json`, run `npm run build`, then re-paste `6-officers.html` and `7-contact.html`.
- **Points and Calendar:** edit the Google Sheet or Google Calendar. No re-paste needed.

---

## What you still need to provide

| # | What | Where it goes |
|---|---|---|
| 1 | **Points sheet link.** In Sheets: File → Share → Publish to web → the points tab → **CSV** → Publish, then copy the link. Also confirm your column headers (default: `Name, Meetings, Problems, Contests, Total`). ⚠️ Published sheets are **public**, so use first name + last initial. | `config.js` → `POINTS.POINTS_SHEET_URL` and `POINTS.COLUMNS` |
| 2 | **Google Calendar ID** (Calendar settings → Integrate calendar) with the calendar set to public, plus a **Calendar API key** restricted to your site's domain(s) (README → Calendar) | `config.js` → `CALENDAR.CALENDAR_ID`, `CALENDAR.CALENDAR_API_KEY` |
| 3 | **Slide links** after each meeting, plus optional cover images | `data/slides.json` → `slidesUrl`, `coverImage`. Delete the sample entries. |
| 4 | **Point values** for a meeting, a problem and a contest | `config.js` → `POINTS.POINT_VALUES` |
| 5 | **Club email** (the old site's address was hidden from the crawler) | `config.js` → `CLUB_EMAIL` |
| 6 | **Meeting day, time, room** | `config.js` → `MEETING` |
| 7 | *Optional:* officer photos, social links (confirm whether `@dhscompsci` on Instagram is yours), a current Remind code, club photos | `data/officers.json` → `photo`, `config.js` → `SOCIAL` / `REMIND_CODE`, `assets/images/originals/` + `npm run images` |
| 8 | **Hosting choice** (A or B) and your custom domain, if any | `config.js` → `SITE_URL`, then `npm run build` |

Add `?setup` to any page URL to see which of these are still missing.
