/* =============================================================================
 *  DHS CS CLUB — SITE CONFIG
 *  -----------------------------------------------------------------------------
 *  This is the ONLY file you need to edit for day-to-day changes.
 *
 *  • Anything that still says "PASTE_..." is a placeholder. While a value is a
 *    placeholder the site keeps working: calendar + points show clearly-labeled
 *    DEMO data, and unfilled facts (meeting time, email…) are simply hidden.
 *  • Open any page with  ?setup  at the end of the URL (e.g. /points/?setup)
 *    to see a checklist of the placeholders that are still unfilled.
 *  • Slides live in  /data/slides.json   — officers in  /data/officers.json.
 *  • Keep the quotes and commas! After editing, reload the page to see changes.
 * ========================================================================== */

const CONFIG = {
  /* ---------------------------------------------------------------------------
   * CLUB & SCHOOL
   * ------------------------------------------------------------------------ */
  CLUB_NAME: 'Dulles Computer Science Club',
  CLUB_SHORT_NAME: 'DHS CS Club',
  SCHOOL: {
    name: 'Dulles High School',
    location: 'Sugar Land, TX', // Shown in the footer + search-engine data. Confirm!
  },

  /* Club email — the old Weebly site's address was hidden from our crawler.
   * Paste the club's usual email here, e.g. 'dullescsclub@gmail.com'. */
  CLUB_EMAIL: 'PASTE_CLUB_EMAIL_HERE',

  /* Remind class code (e.g. '@dhscs26'). The old site listed '@dhscs24', which
   * looks outdated. Leave '' to hide it. */
  REMIND_CODE: '',

  /* Social links. Leave a value as '' to hide that icon everywhere.
   * (An Instagram account named @dhscompsci exists, but it wasn't linked from
   * the old site, so it's left off until you confirm it's the club's.) */
  SOCIAL: {
    instagram: '', // e.g. 'https://www.instagram.com/dhscompsci/'
    github: '',    // e.g. 'https://github.com/dullescompsci'
    discord: '',   // e.g. 'https://discord.gg/xxxxxxx'
  },

  /* ---------------------------------------------------------------------------
   * MEETINGS  (shown on Home, Contact, and used to time slide releases)
   * ------------------------------------------------------------------------ */
  MEETING: {
    day: 'PASTE_MEETING_DAY',   // e.g. 'Thursdays'
    time: 'PASTE_MEETING_TIME', // e.g. '4:15 – 5:15 PM'
    room: 'PASTE_MEETING_ROOM', // e.g. 'Room B105'
    /* 24-hour time meetings usually END. Slides unlock at this time on the
     * meeting date unless a slides entry sets its own "availableFrom". */
    endTime24: '17:00',
    /* Timezone the club meets in (used for slide unlock times). */
    timezone: 'America/Chicago',
  },

  /* ---------------------------------------------------------------------------
   * CALENDAR  (Calendar page, "Next meeting" countdown, Home "Upcoming" strip)
   *  1. Make your Google Calendar public (see README → "Calendar").
   *  2. Paste its Calendar ID below (looks like  abc123@group.calendar.google.com).
   *  3. Create a Google Calendar API key restricted to your site's domain and
   *     paste it below. (A browser API key is designed to be public — the
   *     domain restriction is what protects it.)
   * ------------------------------------------------------------------------ */
  CALENDAR: {
    CALENDAR_ID: 'PASTE_GOOGLE_CALENDAR_ID_HERE',
    CALENDAR_API_KEY: 'PASTE_GOOGLE_CALENDAR_API_KEY_HERE',
    CACHE_MINUTES: 5, // How long to reuse fetched events (per browser tab).
    /* Events are color-coded by the FIRST type whose keyword appears in the
     * event title (then description). Order matters. Case doesn't. */
    EVENT_TYPES: [
      { id: 'contest',  label: 'Contest',  keywords: ['contest', 'competition', 'uil', 'hackathon', 'invitational', 'hp codewars', 'acsl', 'usaco'] },
      { id: 'workshop', label: 'Workshop', keywords: ['workshop', 'lesson', 'tutorial', 'guest', 'speaker', 'talk', 'bootcamp'] },
      { id: 'social',   label: 'Social',   keywords: ['social', 'party', 'pizza', 'game', 'bonding', 'celebration', 'banquet'] },
      { id: 'meeting',  label: 'Meeting',  keywords: ['meeting', 'club', 'practice', 'session'] },
    ],
  },

  /* ---------------------------------------------------------------------------
   * POINTS  (Points page + Home teaser)
   *  In Google Sheets: File → Share → Publish to web → pick the sheet tab →
   *  "Comma-separated values (.csv)" → Publish → copy the link and paste it
   *  below. A normal Sheets link (…/edit#gid=0) also works if the sheet is
   *  published; the site converts it automatically.
   *  ⚠ Published sheets are PUBLIC. Consider "First name + last initial".
   * ------------------------------------------------------------------------ */
  POINTS: {
    POINTS_SHEET_URL: 'PASTE_PUBLISHED_GOOGLE_SHEET_CSV_URL_HERE',

    /* Header names in YOUR sheet. If a header isn't found the site tries to
     * auto-detect it (e.g. "Student", "Attendance", "Solved", "Score"). */
    COLUMNS: {
      name: 'Name',
      meetings: 'Meetings',
      problems: 'Problems',
      contests: 'Contests',
      total: 'Total', // If your sheet has no Total column, it's computed as the sum.
    },

    /* OPTIONAL: if your sheet has MANY columns per category (e.g. one column
     * per meeting date), list them here and they'll be summed into that
     * category. Use exact header names, or '*' wildcards: 'Meeting *', '9/*'.
     * When a group is non-empty it REPLACES the single column above. */
    COLUMN_GROUPS: {
      meetings: [], // e.g. ['9/*', '10/*']  or  ['Meeting 1', 'Meeting 2']
      problems: [], // e.g. ['Problems *']
      contests: [], // e.g. ['Contest *']
    },

    /* How many points each thing is worth — shown in "How points work".
     * Replace the 'X' placeholders with numbers, e.g. meeting: 1. */
    POINT_VALUES: {
      meeting: 'X', // per meeting attended
      problem: 'X', // per problem solved
      contest: 'X', // per contest competed in
    },

    /* false = your sheet already stores POINTS in each column (most common).
     * true  = your sheet stores COUNTS (e.g. 5 meetings) and the site should
     *         multiply by POINT_VALUES above (only once those are numbers). */
    VALUES_ARE_COUNTS: false,

    REFRESH_MINUTES: 5, // Auto-refresh while the page is open.
    PAGE_SIZE: 25,      // Leaderboard rows per page.
  },

  /* ---------------------------------------------------------------------------
   * HOSTING
   * ------------------------------------------------------------------------ */
  /* The public URL of the site, NO trailing slash. Used for share previews,
   * the sitemap, and by the Weebly export to load images + fresh data.
   * GitHub Pages default for this repo is shown; change it if you use Netlify
   * or a custom domain (e.g. 'https://dhscompsci.org'). */
  SITE_URL: 'https://90html.github.io/csclubsite',

  /* Only for Option B (pages pasted into Weebly): the Weebly URL of each page,
   * so the nav inside the embeds links to your Weebly pages. */
  WEEBLY_PAGE_URLS: {
    home: 'https://dhscompsci.weebly.com/',
    gettingStarted: 'https://dhscompsci.weebly.com/getting-started.html',
    slides: 'https://dhscompsci.weebly.com/slides.html',
    calendar: 'https://dhscompsci.weebly.com/calendar.html',
    points: 'https://dhscompsci.weebly.com/points.html',
    officers: 'https://dhscompsci.weebly.com/officers.html',
    contact: 'https://dhscompsci.weebly.com/contact-us.html',
  },

  /* Weebly export: when true, the embeds try to download the latest
   * slides.json / officers.json from SITE_URL, falling back to the copy that
   * was baked in when you ran `npm run build`. */
  EMBED_FETCH_LIVE_DATA: true,

  /* Inside Weebly (or any iframe): show this site's own navbar + footer?
   * Set false if you'd rather use Weebly's navigation and footer only. */
  EMBED_SHOW_HEADER_FOOTER: true,
};

export default CONFIG;
