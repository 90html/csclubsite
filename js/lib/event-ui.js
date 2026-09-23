/* Event details modal, "when" formatting and countdowns (Calendar + Home). */
import { openModal } from '../core/modal.js';
import { icon } from '../core/icons.js';
import { addDays, esc, fmt, formatTime, sameDay } from '../core/utils.js';
import { downloadICS, googleCalendarUrl } from './ics.js';
import { sanitizeToFragment } from './sanitize.js';

export const TYPE_COLORS = {
  meeting: 'var(--c-meeting)',
  contest: 'var(--c-contest)',
  workshop: 'var(--c-workshop)',
  social: 'var(--c-social)',
  other: 'var(--c-other)',
};

const tzLabel = () => {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part ? part.value : '';
  } catch {
    return '';
  }
};

/** "Thu, Sep 24 · 4:15 – 5:15 PM" in the visitor's timezone. */
export function formatWhen(ev, { withTz = false } = {}) {
  const day = (d) => fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
  if (ev.allDay) {
    const last = addDays(ev.end, -1);
    return sameDay(ev.start, last) || last < ev.start ? `${day(ev.start)} · All day` : `${day(ev.start)} – ${day(last)} · All day`;
  }
  const time = sameDay(ev.start, ev.end)
    ? `${day(ev.start)} · ${formatTime(ev.start)} – ${formatTime(ev.end)}`
    : `${day(ev.start)} ${formatTime(ev.start)} – ${day(ev.end)} ${formatTime(ev.end)}`;
  return withTz ? `${time} ${tzLabel()}`.trim() : time;
}

/** @param {HTMLElement} [returnFocus] element to focus when the modal closes */
export function openEventModal(ev, returnFocus) {
  const body = document.createElement('div');
  body.className = 'event-detail';
  body.innerHTML = `
    <ul class="event-detail__facts" role="list">
      <li>${icon('clock')}<span>${esc(formatWhen(ev, { withTz: true }))}</span></li>
      ${ev.location ? `<li>${icon('pin')}<span>${esc(ev.location)}</span></li>` : ''}
    </ul>
    <div class="event-detail__desc prose"></div>
    <div class="event-detail__actions">
      <a class="btn btn--primary" href="${esc(googleCalendarUrl(ev))}" target="_blank" rel="noopener">${icon('calendar')} Add to Google Calendar<span class="sr-only"> (opens in a new tab)</span></a>
      <button type="button" class="btn btn--ghost" data-ics>${icon('download')} Download .ics</button>
    </div>`;
  const desc = body.querySelector('.event-detail__desc');
  if (ev.description) desc.append(sanitizeToFragment(ev.description));
  else desc.remove();
  body.querySelector('[data-ics]').addEventListener('click', () => downloadICS(ev));
  openModal({ title: ev.title, eyebrow: ev.type.label, body, accent: TYPE_COLORS[ev.type.id] || TYPE_COLORS.other, returnFocus });
}

/** Live countdown; returns a stop() function. */
export function startCountdown(el, ev, onDone) {
  const units = el.querySelectorAll('[data-unit]');
  const tick = () => {
    const now = Date.now();
    if (now >= ev.start.getTime()) {
      stop();
      onDone?.(now < ev.end.getTime());
      return;
    }
    let s = Math.floor((ev.start.getTime() - now) / 1000);
    const values = { d: Math.floor(s / 86400), h: Math.floor((s %= 86400) / 3600), m: Math.floor((s %= 3600) / 60), s: s % 60 };
    units.forEach((u) => {
      const v = String(values[u.dataset.unit]).padStart(2, '0');
      if (u.textContent !== v) u.textContent = v;
    });
  };
  const timer = setInterval(tick, 1000);
  const stop = () => clearInterval(timer);
  tick();
  return stop;
}

export function countdownMarkup() {
  return `<div class="countdown mono" role="timer" aria-live="off">
    <div><span data-unit="d">--</span><small>days</small></div>
    <div><span data-unit="h">--</span><small>hrs</small></div>
    <div><span data-unit="m">--</span><small>min</small></div>
    <div><span data-unit="s">--</span><small>sec</small></div>
  </div>`;
}
