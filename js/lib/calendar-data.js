/* Calendar data: Google Calendar API v3 (events.list) → normalized events.
 * Falls back to generated DEMO events while the calendar ID or API key in
 * config.js is still a placeholder. */
import CONFIG from '../../config.js';
import { cache } from '../core/site.js';
import { addDays, isPlaceholder, parseLocalDate, startOfDay, zonedTime } from '../core/utils.js';

const CAL = CONFIG.CALENDAR;
const SCHEDULE = CONFIG.MEETING?.SCHEDULE;
const HAS_GOOGLE = !isPlaceholder(CAL.CALENDAR_ID) && !isPlaceholder(CAL.CALENDAR_API_KEY);
const HAS_SCHEDULE = Boolean(SCHEDULE && /^\d{4}-\d{2}-\d{2}$/.test(SCHEDULE.firstMeeting || '') && SCHEDULE.everyWeeks > 0);

/** Where events come from: 'google' (Calendar API), 'schedule' (config.js), or 'demo'. */
export const SOURCE = HAS_GOOGLE ? 'google' : HAS_SCHEDULE ? 'schedule' : 'demo';
export const IS_DEMO = SOURCE === 'demo';

/** Notice shown above the calendar when it isn't reading Google Calendar yet (HTML). */
export function sourceNote() {
  if (SOURCE === 'schedule') {
    const when = [CONFIG.MEETING.day, CONFIG.MEETING.time].filter((v) => !isPlaceholder(v)).join(' at ');
    return `<strong>Our regular meeting schedule${when ? `: ${when}` : ''}.</strong> Contests, workshops and date changes will appear here once the full club calendar is connected.`;
  }
  if (SOURCE === 'demo') {
    return '<strong>Demo data.</strong> These sample events are shown because the Google Calendar ID and API key in <code>config.js</code> haven\'t been added yet.';
  }
  return '';
}

const OTHER = { id: 'other', label: 'Event' };

/** Detect an event's type from keywords in config (title first, then description). */
export function detectType(title = '', description = '') {
  const types = CAL.EVENT_TYPES || [];
  // Keywords must start a word ("uil" matches "UIL" but not "build").
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const find = (text) =>
    types.find((t) => t.keywords.some((k) => new RegExp(`\\b${escRe(k)}`, 'i').test(text)));
  const hit = find(title) || find(description.replace(/<[^>]+>/g, ' '));
  return hit ? { id: hit.id, label: hit.label } : OTHER;
}

const LEGEND_ORDER = ['meeting', 'contest', 'workshop', 'social'];
export const EVENT_TYPE_LEGEND = [
  ...(CAL.EVENT_TYPES || [])
    .map((t) => ({ id: t.id, label: t.label }))
    .sort((a, b) => (LEGEND_ORDER.indexOf(a.id) + 1 || 99) - (LEGEND_ORDER.indexOf(b.id) + 1 || 99)),
  OTHER,
];

/** Turn a Google API item into our event shape. */
function normalize(item) {
  const allDay = Boolean(item.start?.date);
  const start = allDay ? parseLocalDate(item.start.date) : new Date(item.start?.dateTime);
  let end = allDay ? parseLocalDate(item.end?.date) : new Date(item.end?.dateTime);
  if (!end || Number.isNaN(end.getTime())) end = allDay ? addDays(start, 1) : start;
  const title = item.summary?.trim() || 'Untitled event';
  const description = item.description || '';
  return {
    id: item.id,
    title,
    description,
    location: item.location || '',
    start,
    end, // exclusive for all-day events (Google convention)
    allDay,
    type: detectType(title, description),
  };
}

class CalendarError extends Error {}

async function fetchRange(timeMin, timeMax) {
  const key = `cal:${CAL.CALENDAR_ID}:${timeMin.toISOString()}:${timeMax.toISOString()}`;
  const cached = cache.get(key, (CAL.CACHE_MINUTES || 5) * 60_000);
  if (cached) return cached;

  const items = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      key: CAL.CALENDAR_API_KEY,
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL.CALENDAR_ID)}/events?${params}`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      throw new CalendarError('Couldn’t reach Google Calendar. Check your connection and try again.');
    }
    if (!res.ok) {
      const hint =
        res.status === 404
          ? 'The calendar wasn’t found. Is it public, and is the Calendar ID right?'
          : res.status === 403 || res.status === 400
            ? 'Google refused the request. Check the API key and its website restrictions.'
            : `Google Calendar returned an error (${res.status}).`;
      throw new CalendarError(hint);
    }
    const json = await res.json();
    items.push(...(json.items || []).filter((i) => i.status !== 'cancelled'));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  cache.set(key, items);
  return items;
}

/* ---------------- Regular schedule (until Google Calendar is connected) ---------------- */
function scheduleItems(timeMin, timeMax) {
  const tz = CONFIG.MEETING.timezone || 'America/Chicago';
  const [y, m, d] = SCHEDULE.firstMeeting.split('-').map(Number);
  const stepDays = 7 * SCHEDULE.everyWeeks;
  const dayMs = 864e5;
  const firstUtc = Date.UTC(y, m - 1, d);
  // Start at the first occurrence that could overlap the range (never before firstMeeting).
  const k0 = Math.max(0, Math.floor((timeMin.getTime() - firstUtc) / (stepDays * dayMs)) - 1);
  const room = isPlaceholder(CONFIG.MEETING.room) ? '' : CONFIG.MEETING.room;
  const items = [];
  for (let k = k0; ; k++) {
    const date = new Date(firstUtc + k * stepDays * dayMs).toISOString().slice(0, 10);
    const start = zonedTime(date, SCHEDULE.startTime24 || '16:00', tz);
    if (start >= timeMax) break;
    const end = new Date(start.getTime() + (SCHEDULE.durationMinutes || 60) * 60_000);
    items.push({
      id: `meeting-${date}`,
      summary: SCHEDULE.title || 'Club Meeting',
      description: 'Regular club meeting. Everyone is welcome, and no experience is needed!',
      location: room,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    });
  }
  return items;
}

/* ---------------- Demo data (only if neither Google nor a schedule is set) ---------------- */
const DEMO_TOPICS = [
  'Java Basics', 'Loops & Arrays', 'Strings', 'Recursion', 'Sorting', 'ArrayLists',
  'Maps & Sets', 'Greedy Algorithms', 'Binary Search', 'Graphs: BFS & DFS', 'Dynamic Programming',
];
const DEMO_DESC = 'This is a <b>demo event</b>. Connect your Google Calendar in <code>config.js</code> to show real events. Practice problems: https://codingbat.com/java';

function demoItems(timeMin, timeMax) {
  const items = [];
  const push = (id, summary, start, end, extra = {}) =>
    items.push({ id, summary, description: DEMO_DESC, location: 'Demo Room', start, end, ...extra });
  const at = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  for (let d = startOfDay(timeMin); d < timeMax; d = addDays(d, 1)) {
    const dow = d.getDay();
    const dom = d.getDate();
    const week = Math.floor((d - new Date(2026, 0, 1)) / (7 * 864e5));
    const nextWeek = addDays(d, 7);
    if (dow === 4) {
      push(`m${dateOnly(d)}`, `Club Meeting: ${DEMO_TOPICS[((week % DEMO_TOPICS.length) + DEMO_TOPICS.length) % DEMO_TOPICS.length]}`,
        { dateTime: at(d, 16, 15) }, { dateTime: at(d, 17, 15) });
    }
    if (dow === 6 && dom >= 8 && dom <= 14) {
      push(`c${dateOnly(d)}`, 'Practice Contest (UIL-style)', { dateTime: at(d, 9, 0) }, { dateTime: at(d, 12, 0) });
    }
    if (dow === 2 && dom >= 15 && dom <= 21) {
      push(`w${dateOnly(d)}`, 'Workshop: Setting Up Your IDE', { dateTime: at(d, 16, 15) }, { dateTime: at(d, 17, 0) });
    }
    if (dow === 5 && nextWeek.getMonth() !== d.getMonth()) {
      push(`s${dateOnly(d)}`, 'Pizza Social & Game Night', { dateTime: at(d, 16, 0) }, { dateTime: at(d, 17, 30) });
    }
    if (dow === 6 && dom >= 22 && dom <= 28 && d.getMonth() % 2 === 0) {
      push(`h${dateOnly(d)}`, 'Weekend Hackathon', { date: dateOnly(d) }, { date: dateOnly(addDays(d, 2)) });
    }
  }
  return items.filter((i) => {
    const s = new Date(i.start.dateTime || i.start.date);
    return s < timeMax && s >= addDays(timeMin, -3);
  });
}

/**
 * Events overlapping [timeMin, timeMax), sorted by start.
 * @returns {Promise<{ events: object[], demo: boolean }>}
 */
export async function getEvents(timeMin, timeMax) {
  const raw =
    SOURCE === 'google' ? await fetchRange(timeMin, timeMax) : SOURCE === 'schedule' ? scheduleItems(timeMin, timeMax) : demoItems(timeMin, timeMax);
  const events = raw
    .map(normalize)
    .filter((e) => e.end > timeMin && e.start < timeMax)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  return { events, demo: IS_DEMO, source: SOURCE };
}

/** Upcoming (or in-progress) events for the next ~4 months. */
export async function getUpcoming() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { events, demo, source } = await getEvents(from, addDays(from, 120));
  return { events: events.filter((e) => e.end > now), demo, source };
}

/** The next meeting-type event (or the next event if none is a meeting). */
export function pickNextMeeting(events) {
  return events.find((e) => e.type.id === 'meeting') || events[0] || null;
}
