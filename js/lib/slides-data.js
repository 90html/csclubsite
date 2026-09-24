/* Slides: load data/slides.json and work out each card's state client-side,
 * so a card unlocks on its own after the meeting — no redeploy needed. */
import CONFIG from '../../config.js';
import { loadData } from '../core/site.js';
import { parseDate, zonedTime } from '../core/utils.js';

/** When does an entry unlock? availableFrom, else the meeting date at MEETING.endTime24. */
export function unlockTime(entry) {
  if (entry.availableFrom) {
    const d = parseDate(entry.availableFrom);
    if (d) return d;
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '');
  if (dateOnly) return zonedTime(entry.date, CONFIG.MEETING.endTime24 || '17:00', CONFIG.MEETING.timezone || 'America/Chicago');
  return parseDate(entry.date) || new Date(8.64e15);
}

/**
 * state: 'open'     → clickable
 *        'upcoming' → before unlock time ("Available after the meeting")
 *        'pending'  → after the meeting but no link yet ("Slides coming soon")
 */
export function slideState(entry, now = new Date()) {
  const unlock = unlockTime(entry);
  if (now < unlock) return 'upcoming';
  if (!String(entry.slidesUrl || '').trim()) return 'pending';
  return 'open';
}

export async function loadSlides() {
  const json = await loadData('slides.json');
  const list = Array.isArray(json) ? json : json.slides || [];
  return list
    .filter((s) => s && s.date)
    .map((s, i) => ({ ...s, id: s.id || `slide-${i}`, title: String(s.title || '').trim() || 'Club Meeting', tags: Array.isArray(s.tags) ? s.tags : s.topic ? [s.topic] : [], _date: parseDate(s.date) }))
    .filter((s) => s._date)
    .sort((a, b) => b._date - a._date);
}
