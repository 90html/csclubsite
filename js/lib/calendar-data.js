/* Calendar data. Combines three sources into one list of events:
 *   1. Club meetings: the every-other-week schedule in config.js (or the
 *      club's own Google Calendar, if CALENDAR_ID is ever set).
 *   2. School days: FBISD holidays, breaks and exams (data/school-calendar.json).
 *   3. MSA events: MSA meetings and socials from the MSA master calendar
 *      (Google Calendar API v3). Other clubs' events there are ignored.
 * A meeting that lands on a no-school day or an MSA event day moves to the
 * next Monday, or is canceled if that day is blocked too. */
import CONFIG from '../../config.js';
import { cache, loadData } from '../core/site.js';
import { addDays, isPlaceholder, parseLocalDate, startOfDay, zonedTime } from '../core/utils.js';

const CAL = CONFIG.CALENDAR;
const SCHEDULE = CONFIG.MEETING?.SCHEDULE;
const TZ = CONFIG.MEETING?.timezone || 'America/Chicago';
const HAS_KEY = !isPlaceholder(CAL.CALENDAR_API_KEY);
const HAS_CLUB_GOOGLE = HAS_KEY && !isPlaceholder(CAL.CALENDAR_ID);
const HAS_MSA = HAS_KEY && !isPlaceholder(CAL.MSA_CALENDAR_ID);
const HAS_SCHEDULE = Boolean(SCHEDULE && /^\d{4}-\d{2}-\d{2}$/.test(SCHEDULE.firstMeeting || '') && SCHEDULE.everyWeeks > 0);

/** Where club meetings come from: 'google' (club calendar) or 'schedule' (config.js). */
export const SOURCE = HAS_CLUB_GOOGLE ? 'google' : 'schedule';

/** First and last viewable day of the calendar (local dates). */
export const RANGE = {
  start: parseLocalDate(CAL.RANGE?.start || '2026-08-01'),
  end: parseLocalDate(CAL.RANGE?.end || '2027-05-31'),
};

const TYPES = {
  meeting: { id: 'meeting', label: 'Meeting' },
  canceled: { id: 'other', label: 'Canceled' },
  school: { id: 'school', label: 'School' },
  msa: { id: 'msa', label: 'MSA' },
  social: { id: 'social', label: 'Social' },
  other: { id: 'other', label: 'Event' },
};

/** Detect a club-calendar event's type from keywords in config (title first, then description). */
export function detectType(title = '', description = '') {
  const types = CAL.EVENT_TYPES || [];
  // Keywords must start a word ("uil" matches "UIL" but not "build").
  const find = (text) => types.find((t) => t.keywords.some((k) => wordStart(k).test(text)));
  const hit = find(title) || find(description.replace(/<[^>]+>/g, ' '));
  return hit ? { id: hit.id, label: hit.label } : TYPES.other;
}

function wordStart(keyword) {
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
}

export const EVENT_TYPE_LEGEND = [
  TYPES.meeting,
  ...(CAL.EVENT_TYPES || []).filter((t) => t.id !== 'meeting' && t.id !== 'social').map((t) => ({ id: t.id, label: t.label })),
  TYPES.social,
  { id: 'msa', label: 'MSA event' },
  { id: 'school', label: 'School calendar' },
  { id: 'other', label: 'Canceled / other' },
];

/** Notice shown above the calendar (HTML). */
export function sourceNote() {
  if (SOURCE === 'google') return '';
  const when = [CONFIG.MEETING.day, CONFIG.MEETING.time, CONFIG.MEETING.room].filter((v) => !isPlaceholder(v)).join(', ');
  return `<strong>Club meetings: ${when}.</strong> When school is out or MSA has an event that day, the meeting moves to the next Monday. School holidays come from the FBISD 2026–27 calendar${HAS_MSA ? ' and MSA events from the MSA master calendar' : ''}.`;
}

/* ---------------- Helpers ---------------- */
const pad = (n) => String(n).padStart(2, '0');
const ymdLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymdInTz = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDaysYmd = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const prettyDay = (ymd) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`));

/** Google API item → our event shape. */
function normalize(item, type) {
  const allDay = Boolean(item.start?.date);
  const start = allDay ? parseLocalDate(item.start.date) : new Date(item.start?.dateTime);
  let end = allDay ? parseLocalDate(item.end?.date) : new Date(item.end?.dateTime);
  if (!end || Number.isNaN(end.getTime())) end = allDay ? addDays(start, 1) : start;
  const title = item.summary?.trim() || 'Untitled event';
  const description = item.description || '';
  return { id: item.id, title, description, location: item.location || '', start, end, allDay, type: type || detectType(title, description) };
}

async function fetchGoogle(calendarId, timeMin, timeMax) {
  const key = `cal:${calendarId}:${timeMin.toISOString()}:${timeMax.toISOString()}`;
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
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      throw new Error('Couldn’t reach Google Calendar. Check your connection and try again.');
    }
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? 'The calendar wasn’t found. Is it public, and is the Calendar ID right?'
          : res.status === 403 || res.status === 400
            ? 'Google refused the request. Check the API key and its website restrictions.'
            : `Google Calendar returned an error (${res.status}).`,
      );
    }
    const json = await res.json();
    items.push(...(json.items || []).filter((i) => i.status !== 'cancelled'));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  cache.set(key, items);
  return items;
}

/** MSA master calendar events that matter to us (MSA meetings + socials). */
function isMsaEvent(item) {
  const title = item.summary || '';
  const has = (list) => (list || []).some((k) => wordStart(k).test(title));
  return has(CAL.MSA_KEYWORDS) && !has(CAL.MSA_IGNORE);
}

/** Every calendar day ("YYYY-MM-DD", club timezone) an event touches. */
function daysOf(ev) {
  const days = [];
  const first = ev.allDay ? ymdLocal(ev.start) : ymdInTz(ev.start);
  const last = ev.allDay ? ymdLocal(addDays(ev.end, -1)) : ymdInTz(new Date(ev.end.getTime() - 1));
  for (let d = first; d <= last; d = addDaysYmd(d, 1)) days.push(d);
  return days;
}

/* ---------------- Club meetings from the schedule ---------------- */
function meetingEvent(date, extra = {}) {
  const start = zonedTime(date, SCHEDULE.startTime24 || '15:00', TZ);
  const end = new Date(start.getTime() + (SCHEDULE.durationMinutes || 45) * 60_000);
  return {
    id: `meeting-${date}`,
    title: SCHEDULE.title || 'Club Meeting',
    description: 'Regular club meeting. Everyone is welcome, and no experience is needed!',
    location: isPlaceholder(CONFIG.MEETING.room) ? '' : CONFIG.MEETING.room,
    start,
    end,
    allDay: false,
    type: TYPES.meeting,
    ...extra,
  };
}

/** @param {Map<string,string>} blocked day → reason  @param {string} lastDay YYYY-MM-DD */
function scheduleMeetings(blocked, lastDay) {
  if (!HAS_SCHEDULE) return [];
  const regular = [];
  for (let d = SCHEDULE.firstMeeting; d <= lastDay; d = addDaysYmd(d, 7 * SCHEDULE.everyWeeks)) regular.push(d);
  const regularSet = new Set(regular);
  const out = (SCHEDULE.extraMeetings || []).filter((d) => !regularSet.has(d)).map((d) => meetingEvent(d));
  for (const d of regular) {
    const reason = blocked.get(d);
    if (!reason) {
      out.push(meetingEvent(d));
      continue;
    }
    const next = addDaysYmd(d, 7);
    if (next <= lastDay && !blocked.has(next) && !regularSet.has(next)) {
      out.push(meetingEvent(next, { description: `Moved from ${prettyDay(d)} (${reason}). Everyone is welcome!` }));
    } else {
      out.push(
        meetingEvent(d, {
          id: `canceled-${d}`,
          title: 'No club meeting',
          description: `Canceled: ${reason}.${next <= lastDay && blocked.has(next) ? ` The next Monday is out too (${blocked.get(next)}).` : ''}`,
          location: '',
          type: TYPES.canceled,
          canceled: true,
        }),
      );
    }
  }
  return out;
}

/* ---------------- The whole school year, loaded once ---------------- */
let yearPromise;
function loadYear() {
  if (!yearPromise) {
    yearPromise = (async () => {
      const yearStart = RANGE.start;
      const yearEnd = addDays(RANGE.end, 1);
      const [school, msaResult] = await Promise.all([
        loadData('school-calendar.json').catch(() => ({ events: [] })),
        HAS_MSA
          ? fetchGoogle(CAL.MSA_CALENDAR_ID, yearStart, yearEnd).then((items) => ({ items }), (error) => ({ items: [], error }))
          : { items: [] },
      ]);

      const schoolEvents = (school.events || []).map((e, i) => ({
        id: `school-${i}`,
        title: e.title,
        description: 'From the FBISD 2026–27 instructional calendar.',
        location: '',
        start: parseLocalDate(e.start),
        end: addDays(parseLocalDate(e.end || e.start), 1),
        allDay: true,
        type: TYPES.school,
        noSchool: Boolean(e.noSchool),
      }));
      const msaEvents = msaResult.items.filter(isMsaEvent).map((item) => {
        const ev = normalize(item, /\bsocial/i.test(item.summary || '') ? TYPES.social : TYPES.msa);
        ev.description ||= 'From the Dulles MSA master calendar.';
        return ev;
      });

      // Days that block a club meeting, with the reason.
      const blocked = new Map();
      for (const ev of schoolEvents) if (ev.noSchool) for (const d of daysOf(ev)) blocked.set(d, ev.title);
      for (const ev of msaEvents) for (const d of daysOf(ev)) if (!blocked.has(d)) blocked.set(d, ev.title);

      const lastDay = school.lastDay || ymdLocal(RANGE.end);
      const club =
        SOURCE === 'google'
          ? (await fetchGoogle(CAL.CALENDAR_ID, yearStart, yearEnd)).map((item) => normalize(item))
          : scheduleMeetings(blocked, lastDay);

      const events = [...club, ...msaEvents, ...schoolEvents].sort((a, b) => a.start - b.start || a.end - b.end);
      return { events, msaError: msaResult.error || null };
    })();
    // A failed load (e.g. offline) can be retried.
    yearPromise.catch(() => {
      yearPromise = undefined;
    });
  }
  return yearPromise;
}

/**
 * Events overlapping [timeMin, timeMax), sorted by start.
 * @returns {Promise<{ events: object[], msaError: Error|null }>}
 */
export async function getEvents(timeMin, timeMax) {
  const { events, msaError } = await loadYear();
  return { events: events.filter((e) => e.end > timeMin && e.start < timeMax), msaError };
}

/** Upcoming (or in-progress) events for the next ~4 months. */
export async function getUpcoming() {
  const now = new Date();
  const from = startOfDay(now);
  const { events } = await getEvents(from, addDays(from, 120));
  return { events: events.filter((e) => e.end > now) };
}

/** The next club meeting (skips canceled ones and non-club events). */
export function pickNextMeeting(events) {
  return events.find((e) => e.type.id === 'meeting' && !e.canceled) || null;
}
