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

  /* Club email (shown on Contact + in the footer). */
  CLUB_EMAIL: 'dullescomputerscience@gmail.com',

  /* Remind class code. Leave '' to hide it. */
  REMIND_CODE: 'dhscs27',

  /* Social links. Leave a value as '' to hide it everywhere. */
  SOCIAL: {
    instagram: 'https://www.instagram.com/dullescompsci/',
    discord: 'https://discord.gg/YZTBQjdD6J',
    github: '',
  },

  /* ---------------------------------------------------------------------------
   * MEETINGS  (shown on Home, Contact, and used to time slide releases)
   * ------------------------------------------------------------------------ */
  MEETING: {
    day: 'Every other Monday', // Shown on Home + Contact
    time: '3:00 – 3:45 PM',
    room: 'Room B105',
    /* 24-hour time meetings usually END. Slides unlock at this time on the
     * meeting date unless a slides entry sets its own "availableFrom". */
    endTime24: '16:00',
    /* Timezone the club meets in (used for slide unlock times + the schedule). */
    timezone: 'America/Chicago',

    /* Regular schedule, used by the Calendar page, the "Next meeting"
     * countdown and the Home "Next up" strip.
     * A meeting that falls on a no-school day (data/school-calendar.json) or
     * on the same day as an MSA event (see CALENDAR below) moves to the next
     * Monday; if that day is also blocked, it's canceled. */
    SCHEDULE: {
      firstMeeting: '2026-09-28', // First date of the every-other-week pattern (YYYY-MM-DD)
      everyWeeks: 2,              // 2 = every other week
      extraMeetings: ['2026-09-21'], // One-off meetings outside the pattern (already happened)
      startTime24: '15:00',       // 3:00 PM
      durationMinutes: 45,        // until 3:45 PM (sometimes runs to 4:00)
      title: 'Club Meeting',
    },
  },

  /* ---------------------------------------------------------------------------
   * CALENDAR  (Calendar page, "Next meeting" countdown, Home "Next up" strip)
   *  Shows: club meetings (schedule above) + FBISD holidays/no-school days
   *  (data/school-calendar.json) + MSA events from the MSA master calendar.
   * ------------------------------------------------------------------------ */
  CALENDAR: {
    /* Only months in this range can be viewed (school year). */
    RANGE: { start: '2026-08-01', end: '2027-05-31' },

    /* Google Calendar API key. A browser key is visible to visitors by design;
     * restrict it in Google Cloud to your site's address (see README). */
    CALENDAR_API_KEY: 'AIzaSyAbgEg32t1FspisIWjKEoWgxhE1d9gna74',

    /* Dulles MSA master calendar (public). Events whose title contains an
     * MSA_KEYWORD (and none of MSA_IGNORE) are shown and block CS meetings
     * that day, e.g. "MSA Monthly Meeting", "Halloween Social". Other clubs'
     * meetings on that calendar are ignored. */
    MSA_CALENDAR_ID: 'a9c2c3cbd3c4330f4ead957c94470c8772b071fbc3a870b6145b7103ee62c1fa@group.calendar.google.com',
    MSA_KEYWORDS: ['msa', 'social'],
    MSA_IGNORE: ['club', 'mao', 'interest meeting'],

    /* OPTIONAL: if the club makes its own Google Calendar later, paste its ID
     * here. Club events then come from it instead of the schedule above. */
    CALENDAR_ID: '',

    CACHE_MINUTES: 5, // How long to reuse fetched events (per browser tab).
    /* Colors for events from the club's own calendar are picked by the FIRST
     * type whose keyword starts a word in the title. Order matters. */
    EVENT_TYPES: [
      { id: 'contest',  label: 'Contest',  keywords: ['contest', 'competition', 'uil', 'hackathon', 'invitational', 'hp codewars', 'acsl', 'usaco'] },
      { id: 'workshop', label: 'Workshop', keywords: ['workshop', 'lesson', 'tutorial', 'guest', 'speaker', 'talk', 'bootcamp'] },
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
    /* The points sheet is disconnected for now (last year's roster).
     * When the new one is ready: File → Share → Publish to web → the points
     * tab → CSV → Publish, and paste the link here. Until then the Points
     * page shows "How points work" and a "coming soon" note.
     * ⚠ Published sheets are PUBLIC. Consider "First name + last initial". */
    POINTS_SHEET_URL: '',

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

    /* Points needed each semester to attend the end-of-semester (EOS) party.
     * Shown in "How points work" and on each member's result card. */
    EOS_GOAL: 7,

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
    learnJava: 'https://dhscompsci.weebly.com/learn-java.html',
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
