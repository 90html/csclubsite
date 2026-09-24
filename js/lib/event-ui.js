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
  other: 'var(--c-other)',
  msa: 'var(--c-msa)',
  school: 'var(--c-school)',
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

/** "3:00 – 3:45 PM – Mon, Sep 28" (time first) in the visitor's timezone. */
export function formatTimeDate(ev) {
  const day = (d) => fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
  if (ev.allDay) return formatWhen(ev).replace(' · All day', '');
  let start = formatTime(ev.start);
  const end = formatTime(ev.end);
  const period = / ?[AP]M$/i.exec(end)?.[0];
  if (period && start.endsWith(period)) start = start.slice(0, -period.length); // "3:00 – 3:45 PM"
  return sameDay(ev.start, ev.end) ? `${start} – ${end} – ${day(ev.start)}` : formatWhen(ev);
}

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
    <ul class="facts">
      <li>${esc(formatTimeDate(ev))}${ev.allDay ? '' : ` ${esc(tzLabel())}`}</li>
      ${ev.location ? `<li>${esc(ev.location)}</li>` : ''}
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

/* Rolling digits: each digit is a vertical strip 0, 9, 8 … 0 slid with a CSS
 * transform, so counting down always scrolls the same way. For 0 → 9 the
 * strip first jumps (unanimated) from the bottom 0 to the identical top 0,
 * then rolls on to 9. */
const STRIP = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const ROW_EM = 1.1; // keep in sync with .roll height in site.css

function digitColumn() {
  const col = document.createElement('span');
  col.className = 'roll';
  col.innerHTML = `<span class="roll__strip">${STRIP.map((d) => `<span>${d}</span>`).join('')}</span>`;
  return col;
}

function setDigit(col, digit) {
  const strip = col.firstElementChild;
  const prev = col.dataset.value === undefined ? null : Number(col.dataset.value);
  if (prev === digit) return;
  col.dataset.value = String(digit);
  const move = (row, animate) => {
    strip.classList.toggle('no-anim', !animate);
    strip.style.transform = `translateY(${-row * ROW_EM}em)`;
    if (!animate) void strip.offsetHeight; // commit the jump before the next move
  };
  if (prev === 0 && digit === 9) move(0, false);
  move(10 - digit, prev !== null);
}

function setUnit(u, text) {
  const digits = u.querySelector('.roll-group');
  if (digits.children.length !== text.length) digits.replaceChildren(...[...text].map(digitColumn));
  [...text].forEach((c, i) => setDigit(digits.children[i], Number(c)));
  u.querySelector('.sr-only').textContent = text;
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
    units.forEach((u) => setUnit(u, String(values[u.dataset.unit]).padStart(2, '0')));
  };
  const timer = setInterval(tick, 1000);
  const stop = () => clearInterval(timer);
  tick();
  return stop;
}

export function countdownMarkup() {
  const unit = (k, label) =>
    `<div><span class="countdown__num" data-unit="${k}"><span class="roll-group" aria-hidden="true">--</span><span class="sr-only"></span></span><small>${label}</small></div>`;
  return `<div class="countdown mono" role="timer" aria-live="off">
    ${unit('d', 'days')}${unit('h', 'hrs')}${unit('m', 'min')}${unit('s', 'sec')}
  </div>`;
}
