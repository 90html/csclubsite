/* Home: next meeting strip and latest slides. */
import { initApp, observeReveal } from '../core/app.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/utils.js';
import { getUpcoming, pickNextMeeting } from '../lib/calendar-data.js';
import { countdownMarkup, formatTimeDate, nextMeetingText, openEventModal, startCountdown } from '../lib/event-ui.js';
import { loadSlides } from '../lib/slides-data.js';
import { latestOpenId, numberSlides, slideCard, slideSkeletons } from '../lib/slide-card.js';

initApp();

/* ---------- Next meeting strip ---------- */
async function renderUpcoming() {
  const box = document.querySelector('[data-upcoming]');
  if (!box) return;
  const calNav = document.querySelector('.nav-links [data-nav="calendar"]');
  const calHref = calNav?.getAttribute('href') || 'calendar/';
  const calTarget = calNav?.getAttribute('target');
  const calLink = `<a class="btn btn--ghost" href="${esc(calHref)}"${calTarget ? ` target="${esc(calTarget)}"` : ''}>Full calendar ${icon('arrowRight')}</a>`;
  try {
    const { events } = await getUpcoming();
    const ev = pickNextMeeting(events);
    if (!ev) {
      box.innerHTML = `<div>
        <h3 class="upcoming__title">No meetings scheduled yet</h3>
        <p class="upcoming__meta">New dates are posted on the calendar as soon as they're set.</p></div>
        <div class="upcoming__actions">${calLink}</div>`;
      return;
    }
    const { live, heading, name } = nextMeetingText(ev);
    box.innerHTML = `<div>
        <h3 class="upcoming__title">${heading}</h3>
        <p class="upcoming__meta">${name ? `${esc(name)} · ` : ''}${esc(formatTimeDate(ev))}${ev.location ? ` · ${esc(ev.location)}` : ''}</p>
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
    box.innerHTML = `<div>
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
    observeReveal(grid);
  } catch {
    grid.innerHTML = `<div class="card state state--error state--full">${icon('alert')}<h3>Couldn't load slides</h3><p>Try refreshing the page.</p></div>`;
  }
}

renderUpcoming();
renderSlides();
