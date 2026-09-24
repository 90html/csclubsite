/* Calendar page: custom month grid + agenda view over Google Calendar data. */
import { initApp } from '../core/app.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { addDays, esc, fmt, formatTime, sameDay, startOfDay } from '../core/utils.js';
import { EVENT_TYPE_LEGEND, getEvents, getUpcoming, pickNextMeeting, RANGE, resetCalendarData, SOURCE, sourceNote } from '../lib/calendar-data.js';
import { countdownMarkup, formatTimeDate, formatWhen, nextMeetingText, openEventModal, startCountdown } from '../lib/event-ui.js';

initApp();

const panel = document.querySelector('[data-cal-panel]');
const title = document.querySelector('[data-cal-title]');
const tabs = [...document.querySelectorAll('[role="tab"][data-view]')];
const MAX_PILLS = 3;

const today = startOfDay(new Date());
const firstMonth = new Date(RANGE.start.getFullYear(), RANGE.start.getMonth(), 1);
const lastMonth = new Date(RANGE.end.getFullYear(), RANGE.end.getMonth(), 1);
/** Keep a month inside the school-year range from config.js. */
const clampMonth = (m) => (m < firstMonth ? firstMonth : m > lastMonth ? lastMonth : m);
const state = {
  month: clampMonth(new Date(today.getFullYear(), today.getMonth(), 1)),
  view: matchMedia('(min-width: 48em)').matches ? 'month' : 'agenda',
  events: null, // null until the first month has loaded
};
const monthCache = new Map();
let loadToken = 0;

/* ---------- Helpers ---------- */
const gridStart = (month) => addDays(month, -month.getDay());
/** Last day an event touches (all-day ends are exclusive). */
const lastDay = (ev) => startOfDay(new Date(ev.end.getTime() - 1));
const eventsOn = (day, events) =>
  events
    .filter((ev) => startOfDay(ev.start) <= day && lastDay(ev) >= day)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);

function pillHtml(ev, day, index) {
  const first = sameDay(ev.start, day);
  const last = sameDay(lastDay(ev), day);
  const cls = ['pill', ev.allDay || !sameDay(ev.start, lastDay(ev)) ? 'pill--allday' : '', first ? '' : 'pill--cont-l', last ? '' : 'pill--cont-r'].join(' ');
  const time = !ev.allDay && first ? `<time>${esc(formatTime(ev.start).replace(/:00|\s/g, '').toLowerCase())}</time>` : '';
  return `<button type="button" class="${cls}" data-type="${ev.type.id}" data-ev="${index}">${time}<span>${esc(ev.title)}</span><span class="sr-only">, ${esc(formatWhen(ev))}</span></button>`;
}

function agendaItem(ev, index) {
  const time = ev.allDay ? 'All day' : `${formatTime(ev.start)}`;
  return `<button type="button" class="agenda-item" data-type="${ev.type.id}" data-ev="${index}">
    <span class="agenda-item__time">${esc(time)}</span>
    <span class="agenda-item__main">
      <span class="agenda-item__title">${esc(ev.title)}</span>
      <span class="agenda-item__sub"><span class="agenda-item__type">${esc(ev.type.label)}</span>${ev.location ? `<span>${esc(ev.location)}</span>` : ''}</span>
    </span>
    ${icon('chevronRight')}
  </button>`;
}

/* ---------- Views ---------- */
function renderMonth() {
  const start = gridStart(state.month);
  const dows = Array.from({ length: 7 }, (_, i) => fmt(addDays(start, i), { weekday: 'short' }));
  let html = dows.map((d) => `<div class="month__dow" aria-hidden="true">${esc(d)}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const day = addDays(start, i);
    const evs = eventsOn(day, state.events);
    const out = day.getMonth() !== state.month.getMonth();
    const isToday = sameDay(day, today);
    const label = `${fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ' (today)' : ''}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`;
    const shown = evs.slice(0, evs.length > MAX_PILLS ? MAX_PILLS - 1 : MAX_PILLS);
    html += `<div class="day${out ? ' day--out' : ''}${isToday ? ' day--today' : ''}" role="group" aria-label="${esc(label)}">
      <span class="day__num" aria-hidden="true">${day.getDate()}</span>
      ${shown.map((ev) => pillHtml(ev, day, state.events.indexOf(ev))).join('')}
      ${evs.length > shown.length ? `<button type="button" class="more-btn" data-day="${day.getTime()}">+${evs.length - shown.length} more</button>` : ''}
    </div>`;
  }
  const inMonth = state.events.some((ev) => lastDay(ev) >= state.month && startOfDay(ev.start) < new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1));
  panel.innerHTML = `<div class="month">${html}</div>${
    inMonth ? '' : `<div class="state">${icon('calendar')}<h3>No events this month</h3><p>Try the next month, or check back soon.</p></div>`
  }`;
}

function renderAgenda() {
  const monthEnd = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  const days = [];
  for (let d = new Date(state.month); d < monthEnd; d = addDays(d, 1)) {
    const evs = eventsOn(d, state.events);
    if (evs.length) days.push([new Date(d), evs]);
  }
  if (!days.length) {
    panel.innerHTML = `<div class="state">${icon('calendar')}<h3>No events this month</h3><p>Try the next month, or check back soon.</p></div>`;
    return;
  }
  panel.innerHTML = `<div class="agenda agenda--pad">${days
    .map(
      ([d, evs]) => `<section class="agenda__day" aria-label="${esc(fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }))}">
      <p class="agenda__date${sameDay(d, today) ? ' agenda__date--today' : ''}" aria-hidden="true"><b>${d.getDate()}</b><span>${esc(fmt(d, { weekday: 'short' }))}${sameDay(d, today) ? ' · today' : ''}</span></p>
      <div class="agenda__list">${evs.map((ev) => agendaItem(ev, state.events.indexOf(ev))).join('')}</div>
    </section>`,
    )
    .join('')}</div>`;
}

function render() {
  title.textContent = fmt(state.month, { month: 'long', year: 'numeric' });
  prevBtn.disabled = state.month <= firstMonth;
  nextBtn.disabled = state.month >= lastMonth;
  if (state.view === 'month') renderMonth();
  else renderAgenda();
}

/* ---------- Data ---------- */
async function load() {
  const token = ++loadToken;
  const key = state.month.getTime();
  title.textContent = fmt(state.month, { month: 'long', year: 'numeric' });
  if (!monthCache.has(key)) {
    panel.setAttribute('aria-busy', 'true');
    panel.innerHTML = '<div class="skeleton skeleton--block cal-skeleton"></div>';
    try {
      const start = gridStart(state.month);
      const { events, msaError } = await getEvents(start, addDays(start, 42));
      monthCache.set(key, events);
      showMsaError(msaError);
    } catch (err) {
      if (token !== loadToken) return;
      panel.removeAttribute('aria-busy');
      panel.innerHTML = `<div class="state state--error">${icon('alert')}<h3>Couldn't load the calendar</h3>
        <p>${esc(err.message || 'Something went wrong.')}</p>
        <button type="button" class="btn btn--ghost" data-retry>${icon('refresh')} Try again</button></div>`;
      return;
    }
  }
  if (token !== loadToken) return;
  panel.removeAttribute('aria-busy');
  state.events = monthCache.get(key);
  render();
}

async function renderNext() {
  const box = document.querySelector('[data-next-card]');
  try {
    const { events } = await getUpcoming();
    const ev = pickNextMeeting(events);
    if (!ev) {
      box.innerHTML = `<div class="next-card__main">
        <h2>Nothing scheduled yet</h2><p class="next-card__when">New dates will show up here automatically.</p></div>`;
      return;
    }
    const { live, heading, name } = nextMeetingText(ev);
    box.innerHTML = `<div class="next-card__main">
        <h2>${heading}</h2>
        <ul class="facts">
          ${name ? `<li>${esc(name)}</li>` : ''}
          <li>${esc(formatTimeDate(ev))}</li>
          ${ev.location ? `<li>${esc(ev.location)}</li>` : ''}
        </ul>
      </div>
      <div class="upcoming__actions">
        ${live ? '' : countdownMarkup()}
        <button type="button" class="btn btn--primary btn--sm" data-next-details>Details</button>
      </div>`;
    box.querySelector('[data-next-details]').addEventListener('click', () => openEventModal(ev));
    const cd = box.querySelector('.countdown');
    if (cd) startCountdown(cd, ev, () => renderNext());
  } catch {
    box.innerHTML = `<div class="next-card__main">
      <h2>Next meeting unavailable</h2><p class="next-card__when">We couldn't reach the calendar. The month view below has a retry button.</p></div>`;
  }
}

/* ---------- Controls ---------- */
function setView(view, focus = false) {
  state.view = view;
  tabs.forEach((t) => {
    const on = t.dataset.view === view;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on) {
      panel.setAttribute('aria-labelledby', t.id);
      if (focus) t.focus();
    }
  });
  if (state.events) render();
}

function shiftMonth(delta) {
  state.month = clampMonth(new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1));
  load();
}

const prevBtn = document.querySelector('[data-cal-prev]');
const nextBtn = document.querySelector('[data-cal-next]');
const msaNote = document.querySelector('[data-msa-error]');
/** Show why the MSA calendar failed (Google's own message helps with key setup). */
function showMsaError(error) {
  msaNote.hidden = !error;
  if (!error) return;
  msaNote.querySelector('[data-msa-detail]').textContent = error.detail
    ? `Google says: "${error.detail}"`
    : error.message;
}
msaNote.querySelector('[data-msa-retry]').addEventListener('click', () => {
  resetCalendarData();
  monthCache.clear();
  load();
  renderNext();
});
prevBtn.addEventListener('click', () => shiftMonth(-1));
nextBtn.addEventListener('click', () => shiftMonth(1));
document.querySelector('[data-cal-today]').addEventListener('click', () => {
  state.month = clampMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  load();
});
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => setView(tab.dataset.view));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setView(next.dataset.view, true);
  });
});

panel.addEventListener('click', (e) => {
  const evBtn = e.target.closest('[data-ev]');
  if (evBtn) {
    openEventModal(state.events[Number(evBtn.dataset.ev)]);
    return;
  }
  const more = e.target.closest('[data-day]');
  if (more) {
    const day = new Date(Number(more.dataset.day));
    const evs = eventsOn(day, state.events);
    const body = document.createElement('div');
    body.className = 'day-list';
    body.innerHTML = evs.map((ev) => agendaItem(ev, state.events.indexOf(ev))).join('');
    const { close } = openModal({ title: fmt(day, { weekday: 'long', month: 'long', day: 'numeric' }), eyebrow: `${evs.length} events`, body });
    body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-ev]');
      if (!btn) return;
      close();
      openEventModal(state.events[Number(btn.dataset.ev)], more);
    });
    return;
  }
  if (e.target.closest('[data-retry]')) load();
});

// Legend + demo banner
document.querySelector('[data-legend]').innerHTML = EVENT_TYPE_LEGEND.map(
  (t) => `<li data-type="${t.id}"><i aria-hidden="true"></i>${esc(t.label)}</li>`,
).join('');
const banner = document.querySelector('[data-demo-banner]');
banner.hidden = SOURCE === 'google';
banner.classList.toggle('demo-banner--info', SOURCE === 'schedule');
banner.querySelector('[data-banner-text]').innerHTML = sourceNote();

setView(state.view);
load();
renderNext();
