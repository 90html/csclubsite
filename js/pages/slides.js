/* Slides page: data-driven card grid with search, topic filter and sort. */
import { initApp, observeReveal } from '../core/app.js';
import { icon } from '../core/icons.js';
import { debounce, esc } from '../core/utils.js';
import { normalize } from '../lib/fuzzy.js';
import { loadSlides, slideState } from '../lib/slides-data.js';
import { enableCardFx, latestOpenId, numberSlides, slideCard, slideSkeletons } from '../lib/slide-card.js';

initApp();

const grid = document.querySelector('[data-slide-grid]');
const chipsBox = document.querySelector('[data-topic-chips]');
const search = document.getElementById('slide-q');
const sort = document.getElementById('slide-sort');
const count = document.querySelector('[data-result-count]');

const state = { slides: [], topic: 'all', q: '', sort: 'new' };
let num;
let latest;

function renderChips() {
  const topics = [...new Set(state.slides.flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b));
  chipsBox.innerHTML = ['all', ...topics]
    .map((t) => `<button type="button" class="chip" data-topic="${esc(t)}" aria-pressed="${state.topic === t}">${t === 'all' ? 'All topics' : esc(t)}</button>`)
    .join('');
  chipsBox.hidden = topics.length === 0;
}

function render() {
  const q = normalize(state.q);
  let list = state.slides.filter((s) => state.topic === 'all' || s.tags.includes(state.topic));
  if (q) {
    list = list.filter((s) => normalize(`${s.title} ${s.description || ''} ${s.tags.join(' ')}`).includes(q));
  }
  if (state.sort === 'old') list = [...list].reverse();
  count.textContent = `${list.length} ${list.length === 1 ? 'meeting' : 'meetings'}`;
  if (!list.length) {
    grid.innerHTML = `<div class="card state state--full">${icon('search')}<h3>No slides match</h3>
      <p>Try a different search or topic.</p>
      <button type="button" class="btn btn--ghost" data-reset>Clear filters</button></div>`;
    return;
  }
  grid.innerHTML = list.map((s) => slideCard(s, { number: num(s), latest: s.id === latest, headingLevel: 3 })).join('');
  observeReveal(grid);
}

function reset() {
  state.topic = 'all';
  state.q = '';
  search.value = '';
  renderChips();
  render();
}

async function init() {
  grid.innerHTML = slideSkeletons(6);
  grid.setAttribute('aria-busy', 'true');
  try {
    state.slides = await loadSlides();
    num = numberSlides(state.slides);
    latest = latestOpenId(state.slides);
    grid.removeAttribute('aria-busy');
    if (!state.slides.length) {
      grid.innerHTML = `<div class="card state state--full">${icon('book')}<h3>No slides yet</h3><p>Slides are posted here after each meeting. Check back soon!</p></div>`;
      chipsBox.hidden = true;
      return;
    }
    lastSignature = signature();
    renderChips();
    render();
  } catch {
    grid.removeAttribute('aria-busy');
    grid.innerHTML = `<div class="card state state--error state--full">${icon('alert')}<h3>Couldn't load slides</h3>
      <p>Check your connection and try again.</p><button type="button" class="btn btn--ghost" data-retry>${icon('refresh')} Retry</button></div>`;
  }
}

chipsBox.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-topic]');
  if (!chip) return;
  state.topic = chip.dataset.topic;
  chipsBox.querySelectorAll('[data-topic]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  render();
});
search.addEventListener('input', debounce(() => {
  state.q = search.value;
  render();
}, 120));
sort.addEventListener('change', () => {
  state.sort = sort.value;
  render();
});
grid.addEventListener('click', (e) => {
  if (e.target.closest('[data-reset]')) reset();
  if (e.target.closest('[data-retry]')) init();
});
enableCardFx(grid);

// Re-check lock states every minute, so cards unlock while the page is open.
const signature = () => state.slides.map((s) => slideState(s)).join();
let lastSignature = '';
setInterval(() => {
  if (!state.slides.length) return;
  const sig = signature();
  if (sig === lastSignature) return;
  lastSignature = sig;
  latest = latestOpenId(state.slides);
  render();
}, 60_000);

init();
