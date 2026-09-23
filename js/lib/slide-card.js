/* Slide card markup + behaviors (shared by Home and Slides pages). */
import { assetUrl } from '../core/site.js';
import { icon } from '../core/icons.js';
import { esc, fmt, hashIndex, prefersReducedMotion, safeUrl } from '../core/utils.js';
import { slideState, unlockTime } from './slides-data.js';
import { toast } from '../core/app.js';

const DEMO_URL = '#demo';

function cover(entry, number, state) {
  const img = entry.coverImage
    ? `<img src="${esc(assetUrl(entry.coverImage))}" alt="" loading="lazy" decoding="async" width="640" height="360">`
    : `<div class="gen-cover gen-cover--v${hashIndex(entry.id, 6)}" aria-hidden="true">
        <span class="gen-cover__num mono">#${String(number).padStart(2, '0')}</span>
        <span class="gen-cover__title">${esc(entry.title)}</span>
        <span class="gen-cover__glyph mono">{ }</span>
      </div>`;
  const lock =
    state === 'open'
      ? ''
      : `<div class="slide-card__lock">${icon(state === 'upcoming' ? 'lock' : 'clock')}<span>${
          state === 'upcoming' ? 'Available after the meeting' : 'Slides coming soon'
        }</span></div>`;
  return `<div class="slide-card__cover">${img}${lock}</div>`;
}

/**
 * @param {object} entry  a slides.json entry (with _date)
 * @param {object} opts   { number, latest, headingLevel }
 */
export function slideCard(entry, { number = 1, latest = false, headingLevel = 3, now = new Date() } = {}) {
  const state = slideState(entry, now);
  const date = entry._date;
  const h = `h${headingLevel}`;
  const tags = (entry.tags || []).slice(0, 3).map((t) => `<li class="tag">${esc(t)}</li>`).join('');
  const url = safeUrl(entry.slidesUrl);
  let action;
  if (state === 'open') {
    action = url === DEMO_URL
      ? `<button type="button" class="btn btn--primary btn--sm" data-demo-slide>Open Slides ${icon('arrowRight')}</button>`
      : `<a class="btn btn--primary btn--sm" href="${esc(url)}" target="_blank" rel="noopener">Open Slides ${icon('external')}<span class="sr-only"> for ${esc(entry.title)} (opens in a new tab)</span></a>`;
  } else {
    const unlock = unlockTime(entry);
    const label = state === 'upcoming' ? `Unlocks ${fmt(unlock, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Link coming soon';
    action = `<button type="button" class="btn btn--ghost btn--sm" disabled>${icon('lock')} ${esc(label)}</button>`;
  }
  return `<article class="slide-card slide-card--${state}" data-reveal="stagger" data-tilt>
    ${cover(entry, number, state)}
    <div class="slide-card__body">
      <div class="slide-card__meta">
        <time class="mono" datetime="${esc(entry.date)}">${esc(fmt(date, { month: 'short', day: 'numeric', year: 'numeric' }))}</time>
        ${latest ? '<span class="badge badge--accent">Latest</span>' : ''}
        ${entry.placeholder ? '<span class="badge badge--muted" title="Sample card — replace it in data/slides.json">Sample</span>' : ''}
      </div>
      <${h} class="slide-card__title">${esc(entry.title)}</${h}>
      ${entry.description ? `<p class="slide-card__desc">${esc(entry.description)}</p>` : ''}
      <div class="slide-card__foot">
        ${tags ? `<ul class="tag-list" aria-label="Topics">${tags}</ul>` : '<span></span>'}
        ${action}
      </div>
    </div>
  </article>`;
}

/** Meeting numbers in chronological order (oldest = #1). */
export function numberSlides(slides) {
  const asc = [...slides].sort((a, b) => a._date - b._date);
  const map = new Map(asc.map((s, i) => [s.id, i + 1]));
  return (s) => map.get(s.id) || 1;
}

/** The newest card that is open (gets the "Latest" badge). */
export function latestOpenId(slides, now = new Date()) {
  return slides.find((s) => slideState(s, now) === 'open')?.id;
}

/** Subtle pointer tilt on cards (skipped for touch + reduced motion). */
export function enableCardFx(container) {
  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-demo-slide]')) {
      toast('Sample card: paste the real Google Slides link into data/slides.json.');
    }
  });
  if (prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  container.addEventListener('pointermove', (e) => {
    const card = e.target.closest('[data-tilt]');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  container.addEventListener(
    'pointerout',
    (e) => {
      const card = e.target.closest('[data-tilt]');
      if (card && !card.contains(e.relatedTarget)) {
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      }
    },
    true,
  );
}

export function slideSkeletons(n) {
  return Array.from(
    { length: n },
    () => `<div class="slide-card slide-card--skeleton" aria-hidden="true">
      <div class="slide-card__cover skeleton"></div>
      <div class="slide-card__body"><div class="skeleton skeleton--line w-30"></div><div class="skeleton skeleton--line w-80 h-lg"></div><div class="skeleton skeleton--line w-100"></div><div class="skeleton skeleton--line w-40"></div></div>
    </div>`,
  ).join('');
}
