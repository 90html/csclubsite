# Audit of the old site (dhscompsci.weebly.com)

_Audit date: September 2026_

## How the audit was done (and its limits)

The build environment's network policy **blocked direct access** to `dhscompsci.weebly.com` and to the Wayback Machine (`web.archive.org`). The old HTML, images and embeds therefore **could not be downloaded**. Everything below comes from the page titles, URLs and indexed text that search engines hold for the site.

What that means:

- **No images were recovered.** `/assets/images/` holds only the new site's generated artwork. The photo gallery is data-driven and stays hidden until photos are added (see README, "Add photos").
- **The club email could not be recovered** (search engines show it as `[email protected]`). The club provided it afterwards: `dullescomputerscience@gmail.com`.
- If you can open the old site, check this audit against it before you retire it.

## Page inventory

| Old page | URL | What it held | Decision |
|---|---|---|---|
| Home | `/` | Mission: "bring the art of computer science to all of our members and inspire creative thinking and problem solving through the use of computers"; local and UIL contests; frequent meetings and occasional practice contests. | **Kept and rewritten** as the new Home hero and "What we do" section. |
| Getting Started | `/getting-started.html` | For people new to the club, programming or CS contests: you need a laptop with an IDE, the JDK and basic Java; join the Remind, contact an officer or email the club. | **Kept and merged** into the new Getting Started page. |
| Java Materials | `/java-materials.html` | JDK download; NetBeans-JDK bundle or **Eclipse Neon**; learn basics on w3schools; borrow *Big Java* from Mr. Rogers or Coach Garrett; *Algorithms in Java*; Coursera *Algorithms Part I and II*. | **Merged** into Getting Started as the "Learn Java" resource grid. Outdated items were updated or dropped (see below). No separate page. |
| Misc Links | `/misc-links.html` | A list of extra links; the individual links were not visible in the search index. | **Removed.** The useful, still-valid links are in the Getting Started resource grid. |
| Announcements | `/announcements` | Blog posts, e.g. a guest talk by Mr. Ventura of Ventura Information Systems. | **Removed** as stale. The Calendar and Slides pages replace it. |
| Officers | `/officers.html` | Previous officers (presidents Mahith Gottpatti and Aanya Singh). | **Replaced** with the 2026 roster you supplied (`data/officers.json`). |
| Contact Us | `/contact-us.html` | Club email (obfuscated in search results), Remind code `@dhscs24`, "contact an officer". | **Kept and simplified** into the Contact page, with the current email and Remind code. |

## Outdated content removed

- **Old officers** (Mahith Gottpatti, Aanya Singh and the rest of that roster), replaced by the current roster.
- **Eclipse Neon** (a 2016 release), replaced by a link to the current Eclipse IDE download.
- **"NetBeans-JDK bundle"**: Oracle no longer ships this bundle. It is replaced by separate, current links for the JDK and for Apache NetBeans.
- **Remind code `@dhscs24`**: replaced with the current code, **`@dhscs27`**.
- **Announcements blog** and the dated guest-speaker post: stale.
- **Misc Links**: an unsorted link dump, now curated.
- **The Weebly-style hyperlink list for slides**: replaced by the data-driven Slides card grid.
- **Any embedded Google Calendar or Weebly widgets**: replaced by a native calendar that reads the Google Calendar API.

## Kept (still relevant)

- The club's identity and mission (rewritten to be punchier and beginner-friendly).
- The focus on **Java**, **competitive programming**, and **local and UIL contests**.
- **Practice contests** before contest season.
- The two faculty sponsors: **Mr. Rogers** (Room B105) and **Coach Garrett**.
- Learning resources that are still valid (each URL was checked in September 2026, either by a direct request or against current search results):
  - Oracle JDK downloads, `https://www.oracle.com/java/technologies/downloads/`
  - Apache NetBeans, `https://netbeans.apache.org/front/main/download/`
  - Eclipse IDE, `https://www.eclipse.org/downloads/`
  - W3Schools Java tutorial, `https://www.w3schools.com/java/`
  - *Algorithms, 4th Edition* (Sedgewick and Wayne; the modern *Algorithms in Java*), `https://algs4.cs.princeton.edu/home/`
  - Coursera *Algorithms, Part I* and *Part II* (Princeton, free to audit)
  - *Big Java*: borrow a copy from a sponsor (kept as a tip, not a link)
- Two practice resources added because they match what the club already does (Java and UIL):
  - CodingBat Java, `https://codingbat.com/java`
  - UIL Computer Science (official contest page and practice materials), `https://www.uiltexas.org/academics/stem/computer-science`

## Facts deliberately not invented

The new site does **not** claim member counts, awards, contest results or a founding year. The meeting schedule (every other Monday, 3:00–3:45 PM, Room B105), the FBISD 2026–27 school calendar and the MSA master calendar were provided by the club. The school location ("Sugar Land, TX") is inferred from the UIL (Texas) contest focus. It appears only in structured data and the footer, so confirm or change `SCHOOL.location` in `config.js`.

## Images

| Source | Status |
|---|---|
| Old Weebly photos and banners | **Not recoverable** from this environment (network block). |
| New artwork | A generated logo mark, favicon set, Open Graph image and automatic slide covers. |

To add real photos later, drop them in `assets/images/originals/` and run `npm run images`. The script creates optimized WebP files at several sizes and updates `data/gallery.json`. The "Moments" gallery appears automatically once it has photos.
