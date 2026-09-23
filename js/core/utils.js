/* Small shared helpers. No DOM access at import time, so Node can import this
 * file too (the build script pre-renders the officers page with it). */

/** True when a config value is still an unfilled placeholder. */
export function isPlaceholder(value) {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s === '' || /^PASTE_/i.test(s) || /^X$/i.test(s);
}

/** Escape text for safe insertion into HTML strings. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s)/mailto URLs and relative paths; anything else becomes '#'. */
export function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '#'; // javascript:, data:, etc.
  return s;
}

/** Initials for avatars: "Kavish Mehta" → "KM", "Mr. Rogers" → "R". */
export function initials(name) {
  const parts = String(name || '')
    .replace(/\b(mr|mrs|ms|dr|coach)\.?\s+/gi, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Stable hash → number in [0, n). Used to vary avatar/cover gradients. */
export function hashIndex(str, n) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

/** Short content hash (used to tell whether pre-rendered HTML is stale). */
export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Parse "YYYY-MM-DD" as a LOCAL date (Date() would treat it as UTC). */
export function parseLocalDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Parse an ISO string; date-only strings are treated as local dates. */
export function parseDate(value) {
  if (!value) return null;
  const local = parseLocalDate(value);
  if (local) return local;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convert a wall-clock time in a given IANA timezone to a real Date.
 *  e.g. zonedTime('2026-09-24', '17:00', 'America/Chicago'). */
export function zonedTime(ymd, hhmm, timeZone) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = (hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const offset = (t) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(new Date(t));
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t;
    };
    // Two passes handle DST boundaries correctly.
    let t = guess - offset(guess);
    t = guess - offset(t);
    return new Date(t);
  } catch {
    return new Date(y, mo - 1, d, h, mi); // Unknown timezone → visitor's local time.
  }
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

const fmtCache = new Map();
/** Cached Intl.DateTimeFormat. */
export function fmt(date, options) {
  const key = JSON.stringify(options);
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat(undefined, options));
  return fmtCache.get(key).format(date);
}

export const formatTime = (d) => fmt(d, { hour: 'numeric', minute: '2-digit' });

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
