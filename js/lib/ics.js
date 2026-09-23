/* "Add to Google Calendar" links and single-event .ics downloads. */
import { addDays } from '../core/utils.js';

const pad = (n) => String(n).padStart(2, '0');
const utcStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/** Strip HTML to plain text for calendar descriptions. */
export function toPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function googleCalendarUrl(ev) {
  const dates = ev.allDay
    ? `${dateStamp(ev.start)}/${dateStamp(ev.end)}`
    : `${utcStamp(ev.start)}/${utcStamp(ev.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    details: toPlainText(ev.description).slice(0, 1500),
    location: ev.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Escape + fold text per RFC 5545. */
function icsText(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildICS(ev) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DHS CS Club//Website//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(ev.id || utcStamp(ev.start))}@dhs-cs-club`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ev.allDay ? `DTSTART;VALUE=DATE:${dateStamp(ev.start)}` : `DTSTART:${utcStamp(ev.start)}`,
    ev.allDay
      ? `DTEND;VALUE=DATE:${dateStamp(ev.end > ev.start ? ev.end : addDays(ev.start, 1))}`
      : `DTEND:${utcStamp(ev.end)}`,
    `SUMMARY:${icsText(ev.title)}`,
    ev.location ? `LOCATION:${icsText(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${icsText(toPlainText(ev.description))}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function downloadICS(ev) {
  const blob = new Blob([buildICS(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'event'}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
