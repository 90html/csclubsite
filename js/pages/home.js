/* Home: terminal typing, next meeting strip, latest slides, gallery, points teaser. */
import CONFIG from '../../config.js';
import { initApp, observeReveal } from '../core/app.js';
import { loadData } from '../core/site.js';
import { icon } from '../core/icons.js';
import { esc, isPlaceholder, prefersReducedMotion } from '../core/utils.js';
import { getUpcoming, pickNextMeeting } from '../lib/calendar-data.js';
import { countdownMarkup, formatWhen, openEventModal, startCountdown } from '../lib/event-ui.js';
import { HAS_SHEET } from '../lib/points-data.js';
import { loadSlides } from '../lib/slides-data.js';
import { enableCardFx, latestOpenId, numberSlides, slideCard, slideSkeletons } from '../lib/slide-card.js';

initApp();

/* ---------- Terminal: re-type the pre-rendered snippet ----------
 * The full snippet stays in place (invisible) to hold the size, and the text is
 * typed into an overlay on top, so nothing ever shifts. */
function typeTerminal() {
  const pre = document.querySelector('[data-terminal]');
  if (!pre || prefersReducedMotion()) return;
  const runs = [...pre.childNodes].map((n) => [n.nodeType === 1 ? n.className : '', n.textContent]);
  const ghost = document.createElement('span');
  ghost.className = 'terminal__ghost';
  ghost.append(...pre.childNodes);
  const layer = document.createElement('span');
  layer.className = 'terminal__typed';
  const caret = document.createElement('span');
  caret.className = 'caret';
  layer.append(caret);
  pre.append(ghost, layer);

  let r = 0;
  let i = 0;
  let target = null;
  const step = () => {
    if (r >= runs.length) return;
    const [cls, text] = runs[r];
    if (!target) {
      target = cls ? Object.assign(document.createElement('span'), { className: cls }) : document.createTextNode('');
      layer.insertBefore(target, caret);
    }
    // Program output appears a line at a time; code types character by character.
    const chunk = cls === 'o' ? text.length : 1;
    target.textContent += text.slice(i, i + chunk);
    i += chunk;
    const ch = text[i - 1];
    if (i >= text.length) {
      r++;
      i = 0;
      target = null;
    }
    const delay = cls === 'o' ? 260 : ch === '\n' ? 90 : 18 + Math.random() * 28;
    setTimeout(step, delay);
  };
  setTimeout(step, 500);
}

/* ---------- Stats that depend on data/config ---------- */
async function fillStats() {
  const meeting = document.querySelector('[data-stat-meeting]');
  if (meeting && !isPlaceholder(CONFIG.MEETING.day)) {
    meeting.querySelector('dt').textContent = isPlaceholder(CONFIG.MEETING.room) ? 'We meet' : `We meet · ${CONFIG.MEETING.room}`;
    meeting.querySelector('dd').textContent = CONFIG.MEETING.day;
  }
  try {
    const officers = await loadData('officers.json');
    const count = (officers.groups || []).reduce((n, g) => n + (g.members || []).length, 0);
    const el = document.querySelector('[data-officer-count]');
    if (el && count) el.textContent = String(count);
  } catch {
    /* keep the pre-rendered number */
  }
}

/* ---------- Next meeting strip ---------- */
async function renderUpcoming() {
  const box = document.querySelector('[data-upcoming]');
  if (!box) return;
  const calHref = document.querySelector('.header-cta')?.getAttribute('href') || 'calendar/';
  const calTarget = document.querySelector('.header-cta')?.getAttribute('target');
  const calLink = `<a class="btn btn--ghost" href="${esc(calHref)}"${calTarget ? ` target="${esc(calTarget)}"` : ''}>Full calendar ${icon('arrowRight')}</a>`;
  try {
    const { events } = await getUpcoming();
    const ev = pickNextMeeting(events);
    if (!ev) {
      box.innerHTML = `<div><p class="upcoming__label">${icon('calendar')} Next up</p>
        <h3 class="upcoming__title">No meetings scheduled yet</h3>
        <p class="upcoming__meta">New dates are posted on the calendar as soon as they're set.</p></div>
        <div class="upcoming__actions">${calLink}</div>`;
      return;
    }
    const live = ev.start <= new Date();
    box.innerHTML = `<div>
        <p class="upcoming__label"><span class="live-dot" aria-hidden="true"></span> ${live ? 'Happening now' : 'Next up'}</p>
        <h3 class="upcoming__title">${esc(ev.title)}</h3>
        <p class="upcoming__meta"><span>${icon('clock')}${esc(formatWhen(ev))}</span>${ev.location ? `<span>${icon('pin')}${esc(ev.location)}</span>` : ''}</p>
      </div>
      ${live ? '' : `<div aria-label="Time until it starts">${countdownMarkup()}</div>`}
      <div class="upcoming__actions">
        <button type="button" class="btn btn--primary" data-details>Details</button>
        ${calLink}
      </div>`;
    box.querySelector('[data-details]').addEventListener('click', () => openEventModal(ev));
    const cd = box.querySelector('.countdown');
    if (cd) startCountdown(cd, ev, () => renderUpcoming());
  } catch {
    box.innerHTML = `<div><p class="upcoming__label">${icon('calendar')} Next up</p>
      <h3 class="upcoming__title">Check the calendar for the next meeting</h3>
      <p class="upcoming__meta">We couldn't load upcoming events right now.</p></div>
      <div class="upcoming__actions">${calLink}</div>`;
  }
}

/* ---------- Latest slides ---------- */
async function renderSlides() {
  const grid = document.querySelector('[data-latest-slides]');
  if (!grid) return;
  grid.innerHTML = slideSkeletons(3);
  try {
    const slides = await loadSlides();
    if (!slides.length) {
      grid.innerHTML = `<div class="card state state--full">${icon('book')}<h3>No slides yet</h3><p>Slides show up here after each meeting.</p></div>`;
      return;
    }
    const num = numberSlides(slides);
    const latest = latestOpenId(slides);
    // Newest three, but skip meetings more than a week away.
    const soon = Date.now() + 7 * 864e5;
    const pick = slides.filter((s) => s._date.getTime() <= soon).slice(0, 3);
    grid.innerHTML = (pick.length ? pick : slides.slice(-3))
      .map((s) => slideCard(s, { number: num(s), latest: s.id === latest }))
      .join('');
    enableCardFx(grid);
    observeReveal(grid);
  } catch {
    grid.innerHTML = `<div class="card state state--error state--full">${icon('alert')}<h3>Couldn't load slides</h3><p>Try refreshing the page.</p></div>`;
  }
}

/* ---------- Points teaser → Points page with the name in the #hash (never sent to a server) ---------- */
function initTeaser() {
  document.querySelectorAll('[data-teaser-live]').forEach((el) => {
    el.hidden = !HAS_SHEET;
  });
  document.querySelectorAll('[data-teaser-soon]').forEach((el) => {
    el.hidden = HAS_SHEET;
  });
  const form = document.querySelector('[data-points-teaser]');
  if (!form || !HAS_SHEET) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    const link = form.querySelector('[data-points-link]');
    const url = `${link.href.split('#')[0]}${q ? `#q=${encodeURIComponent(q)}` : ''}`;
    if (link.target === '_top') window.open(url, '_top');
    else location.href = url;
  });
}

typeTerminal();
fillStats();
renderUpcoming();
renderSlides();
initTeaser();
