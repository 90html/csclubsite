/* Points page: live name search (combobox), result card with count-up,
 * sortable/paginated leaderboard with podium, auto-refresh.
 * Privacy: search terms never leave the browser and are never logged. */
import CONFIG from '../../config.js';
import { initApp, toast } from '../core/app.js';
import { scrollToY } from '../core/embed.js';
import { icon } from '../core/icons.js';
import { esc, fmt, hashIndex, initials, isPlaceholder, prefersReducedMotion } from '../core/utils.js';
import { normalize, searchPeople, suggestPeople } from '../lib/fuzzy.js';
import { IS_DEMO, loadPoints, pointsToNextRank } from '../lib/points-data.js';

initApp();

const P = CONFIG.POINTS;
const input = document.getElementById('points-q');
const listbox = document.getElementById('points-listbox');
const resultBox = document.querySelector('[data-result]');
const board = document.querySelector('[data-board]');
const updated = document.querySelector('[data-updated]');
const refreshBtn = document.querySelector('[data-refresh]');

const CATS = [
  { key: 'meetings', label: 'Meetings', short: 'M', icon: 'users', col: 'hasMeetings' },
  { key: 'problems', label: 'Problems', short: 'P', icon: 'puzzle', col: 'hasProblems' },
  { key: 'contests', label: 'Contests', short: 'C', icon: 'trophy', col: 'hasContests' },
];

const state = {
  people: [],
  columns: null,
  fetchedAt: null,
  sort: { key: 'rank', dir: 'asc' },
  page: 0,
  selectedId: null,
  options: [],
  active: -1,
  loaded: false,
};

const fmtNum = (n) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const avatar = (name, cls = '') => `<span class="avatar ${cls} avatar--h${hashIndex(name, 6)}" aria-hidden="true">${esc(initials(name))}</span>`;
const activeCats = () => CATS.filter((c) => state.columns?.[c.col]);

/* ---------------- Point values explainer ---------------- */
document.querySelectorAll('[data-point-value]').forEach((el) => {
  const v = P.POINT_VALUES?.[el.dataset.pointValue];
  el.textContent = isPlaceholder(v) ? 'X' : String(v);
  if (isPlaceholder(v)) el.title = 'Point value coming soon';
});
document.querySelector('[data-demo-banner]').hidden = !IS_DEMO;

/* ---------------- Search combobox ---------------- */
function highlight(name, query) {
  const words = normalize(query).split(' ').filter(Boolean);
  // Wrap the matching start of each name word in <mark>.
  return name
    .split(/(\s+)/)
    .map((part) => {
      const n = normalize(part);
      const w = words.find((q) => n.startsWith(q));
      return w ? `<mark>${esc(part.slice(0, w.length))}</mark>${esc(part.slice(w.length))}` : esc(part);
    })
    .join('');
}

function closeList() {
  listbox.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  state.active = -1;
}

function setActive(i) {
  state.active = i;
  [...listbox.children].forEach((li, idx) => li.setAttribute('aria-selected', String(idx === i)));
  const li = listbox.children[i];
  if (li && li.id) {
    input.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function updateList() {
  const q = input.value.trim();
  if (!q || !state.loaded) {
    closeList();
    return;
  }
  state.options = searchPeople(q, state.people, 8);
  listbox.innerHTML = state.options.length
    ? state.options
        .map(
          (p, i) => `<li role="option" id="opt-${i}" aria-selected="false" data-index="${i}">
          ${avatar(p.name, 'avatar--sm')}
          <span class="li-main">${highlight(p.name, q)}</span>
          <span class="li-meta">#${p.rank} · ${fmtNum(p.total)} pts</span></li>`,
        )
        .join('')
    : `<li class="listbox__empty" role="option" aria-disabled="true" aria-selected="false">No matches yet. Keep typing, or check the spelling.</li>`;
  listbox.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  setActive(state.options.length ? 0 : -1);
}

function choose(person, { scroll = true } = {}) {
  closeList();
  input.value = person.name;
  state.selectedId = person.id;
  renderResult(person);
  goToPersonPage(person);
  renderBoard();
  if (scroll && matchMedia('(max-width: 47.99em)').matches) {
    scrollToY(resultBox.getBoundingClientRect().top + window.scrollY - 90);
  }
}

function submitSearch() {
  const q = input.value.trim();
  if (!q) return;
  if (state.active >= 0 && state.options[state.active]) {
    choose(state.options[state.active]);
    return;
  }
  const matches = searchPeople(q, state.people, 2);
  if (matches.length) choose(matches[0]);
  else renderNoResults(q);
}

input.addEventListener('input', () => {
  updateList();
  if (!input.value.trim()) {
    state.selectedId = null;
    resultBox.innerHTML = '';
    renderBoard();
  }
});
input.addEventListener('focus', () => input.value.trim() && !state.selectedId && updateList());
input.addEventListener('keydown', (e) => {
  const n = state.options.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (listbox.hidden) updateList();
    else if (n) setActive((state.active + 1) % n);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (n) setActive((state.active - 1 + n) % n);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    submitSearch();
  } else if (e.key === 'Escape') {
    if (!listbox.hidden) closeList();
    else input.value = '';
  }
});
input.addEventListener('blur', () => setTimeout(closeList, 120));
listbox.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
listbox.addEventListener('click', (e) => {
  const li = e.target.closest('[data-index]');
  if (li) choose(state.options[Number(li.dataset.index)]);
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    input.focus();
  }
});

/* ---------------- Result card ---------------- */
function countUp(el, to) {
  if (prefersReducedMotion()) {
    el.textContent = fmtNum(to);
    return;
  }
  const start = performance.now();
  const dur = 1100;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = fmtNum(t < 1 ? Math.round(to * eased) : to);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderResult(p) {
  const total = state.people.length;
  const next = pointsToNextRank(p, state.people);
  const cats = activeCats();
  const catSum = cats.reduce((s, c) => s + p[c.key], 0) || 1;
  const tied = state.people.filter((x) => x.rank === p.rank).length > 1;
  resultBox.innerHTML = `<article class="card card--pad result" aria-label="Points for ${esc(p.name)}">
    <div class="result__top">
      <div class="result__who">
        ${avatar(p.name)}
        <div>
          <h3 class="result__name">${esc(p.name)}</h3>
          <p class="result__rank"><span class="badge badge--accent">#${p.rank} of ${total}</span>${tied ? '<span class="badge badge--muted">Tied</span>' : ''}${p.rank <= 3 ? '<span class="badge badge--muted">Podium</span>' : ''}</p>
        </div>
      </div>
      <div class="result__total">
        <span class="result__total-num" data-count aria-hidden="true">0</span><span class="sr-only">${fmtNum(p.total)}</span>
        <span class="result__total-label">Total points</span>
      </div>
    </div>
    ${
      cats.length
        ? `<div class="breakdown">${cats
            .map((c) => {
              const share = Math.round((p[c.key] / catSum) * 100);
              return `<div class="metric metric--${c.key}">
                <p class="metric__head">${icon(c.icon)}${c.label}</p>
                <p class="metric__value">${fmtNum(p[c.key])}<small>${share}% of total</small></p>
                <div class="bar" role="progressbar" aria-label="${c.label} share of total" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${share}"><span data-bar="${share}"></span></div>
              </div>`;
            })
            .join('')}</div>`
        : ''
    }
    <p class="result__next">${
      next
        ? `${icon('target')}<span><strong>${fmtNum(next.points)}</strong> more ${next.points === 1 ? 'point' : 'points'} to reach #${next.rank}.</span>`
        : `${icon('trophy')}<span>You're in first place. Nice work!</span>`
    }</p>
  </article>`;
  countUp(resultBox.querySelector('[data-count]'), p.total);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => resultBox.querySelectorAll('[data-bar]').forEach((b) => (b.style.width = `${b.dataset.bar}%`))),
  );
}

function renderNoResults(q) {
  const suggestions = suggestPeople(q, state.people, 3);
  resultBox.innerHTML = `<div class="card state no-results">${icon('search')}
    <h3>No one matches “${esc(q)}”</h3>
    <p>Try just your first name, or check the spelling. New members show up after an officer adds you to the sheet.</p>
    ${
      suggestions.length
        ? `<p>Did you mean:</p><div class="no-results__suggest">${suggestions
            .map((s) => `<button type="button" class="chip" data-suggest="${esc(s.id)}">${esc(s.name)}</button>`)
            .join('')}</div>`
        : ''
    }</div>`;
  closeList();
}
resultBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-suggest]');
  if (b) choose(state.people.find((p) => p.id === b.dataset.suggest));
});

/* ---------------- Leaderboard ---------------- */
function sorted() {
  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  return [...state.people].sort((a, b) => {
    const r = key === 'name' ? a.name.localeCompare(b.name) : key === 'rank' ? a.rank - b.rank || a.name.localeCompare(b.name) : a[key] - b[key];
    return r * mul || a.rank - b.rank;
  });
}

function goToPersonPage(person) {
  const idx = sorted().findIndex((p) => p.id === person.id);
  if (idx >= 0) state.page = Math.floor(idx / (P.PAGE_SIZE || 25));
}

function th(key, label, num = false) {
  const on = state.sort.key === key;
  const sortAttr = on ? ` aria-sort="${state.sort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
  return `<th scope="col"${sortAttr} class="${num ? 'num' : ''}"><button type="button" data-sort="${key}">${label}${icon('sort')}<span class="sr-only">, sort</span></button></th>`;
}

function renderBoard() {
  if (!state.loaded) return;
  const people = state.people;
  if (!people.length) {
    board.innerHTML = `<div class="card state">${icon('users')}<h3>No points yet</h3><p>The leaderboard fills up as soon as officers add points to the sheet.</p></div>`;
    return;
  }
  const cats = activeCats();
  const size = P.PAGE_SIZE || 25;
  const list = sorted();
  const pages = Math.max(1, Math.ceil(list.length / size));
  state.page = Math.min(state.page, pages - 1);
  const slice = list.slice(state.page * size, state.page * size + size);
  const top = people.slice(0, 3);

  const podium =
    people.length >= 3
      ? `<ol class="podium" role="list" aria-label="Top three">${top
          .map(
            (p, i) => `<li class="card podium__spot podium__spot--${i + 1}">
          <span class="podium__medal" aria-hidden="true">${p.rank}</span>
          ${avatar(p.name)}
          <span class="podium__name">${esc(p.name)}<span class="sr-only">, rank ${p.rank}</span></span>
          <span class="podium__pts">${fmtNum(p.total)} pts</span></li>`,
          )
          .join('')}</ol>`
      : '';

  const rows = slice
    .map((p) => {
      const sub = cats.map((c) => `${c.short} ${fmtNum(p[c.key])}`).join(' · ');
      return `<tr class="${p.id === state.selectedId ? 'is-me' : ''}"${p.id === state.selectedId ? ' aria-current="true"' : ''}>
      <td class="rank">#${p.rank}</td>
      <td><button type="button" class="who-btn" data-pick="${esc(p.id)}">${avatar(p.name, 'avatar--sm')}<span class="who__text"><span class="who__name">${esc(p.name)}</span>${sub ? `<span class="who__sub" aria-hidden="true">${sub}</span>` : ''}</span></button></td>
      ${cats.map((c) => `<td class="num cat">${fmtNum(p[c.key])}</td>`).join('')}
      <td class="num total">${fmtNum(p.total)}</td>
    </tr>`;
    })
    .join('');

  board.innerHTML = `${podium}
  <div class="table-wrap">
    <table class="board">
      <caption class="sr-only">Club points leaderboard, sorted by ${esc(state.sort.key)}. Page ${state.page + 1} of ${pages}.</caption>
      <thead><tr>${th('rank', 'Rank')}${th('name', 'Name')}${cats.map((c) => th(c.key, c.label, true)).join('')}${th('total', 'Total', true)}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="pager">
      <span>Showing ${state.page * size + 1}–${state.page * size + slice.length} of ${list.length}</span>
      <div class="pager__btns">
        <button type="button" class="icon-btn" data-page="-1" aria-label="Previous page" ${state.page === 0 ? 'disabled' : ''}>${icon('chevronLeft')}</button>
        <button type="button" class="icon-btn" data-page="1" aria-label="Next page" ${state.page >= pages - 1 ? 'disabled' : ''}>${icon('chevronRight')}</button>
      </div>
    </div>
  </div>`;
  board.removeAttribute('aria-busy');
}

board.addEventListener('click', (e) => {
  const sortBtn = e.target.closest('[data-sort]');
  if (sortBtn) {
    const key = sortBtn.dataset.sort;
    const defaultDir = key === 'rank' || key === 'name' ? 'asc' : 'desc';
    state.sort = state.sort.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir };
    state.page = 0;
    renderBoard();
    board.querySelector(`[data-sort="${key}"]`)?.focus();
    return;
  }
  const pageBtn = e.target.closest('[data-page]');
  if (pageBtn && !pageBtn.disabled) {
    state.page += Number(pageBtn.dataset.page);
    renderBoard();
    board.querySelector(`[data-page="${pageBtn.dataset.page}"]`)?.focus();
    return;
  }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const person = state.people.find((p) => p.id === pick.dataset.pick);
    if (person) {
      choose(person, { scroll: false });
      scrollToY(document.querySelector('.points-search').getBoundingClientRect().top + window.scrollY - 90);
    }
  }
});

/* ---------------- Loading + refresh ---------------- */
function renderUpdated() {
  if (!state.fetchedAt) return;
  updated.innerHTML = `<span class="live-dot" aria-hidden="true"></span>Last updated ${esc(fmt(state.fetchedAt, { hour: 'numeric', minute: '2-digit' }))}${IS_DEMO ? ' · <span class="badge badge--demo">Demo</span>' : ''}`;
}

async function load({ manual = false } = {}) {
  refreshBtn.disabled = true;
  refreshBtn.classList.add('is-spinning');
  try {
    const data = await loadPoints();
    state.people = data.people;
    state.columns = data.columns;
    state.fetchedAt = data.fetchedAt;
    state.loaded = true;
    renderUpdated();
    renderBoard();
    // Keep the open result card in sync with fresh data.
    if (state.selectedId) {
      const p = state.people.find((x) => x.id === state.selectedId);
      if (p) renderResult(p);
    }
    if (manual) toast('Points refreshed.', 'success');
  } catch (err) {
    if (!state.loaded) {
      board.removeAttribute('aria-busy');
      board.innerHTML = `<div class="card state state--error">${icon('alert')}<h3>Couldn't load points</h3>
        <p>${esc(err.message || 'Something went wrong.')}</p>
        <button type="button" class="btn btn--ghost" data-retry>${icon('refresh')} Try again</button></div>`;
      board.querySelector('[data-retry]').addEventListener('click', () => load({ manual: true }));
    } else {
      updated.textContent = 'Refresh failed. Showing the last loaded data.';
    }
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('is-spinning');
  }
}

refreshBtn.addEventListener('click', () => load({ manual: true }));
setInterval(() => {
  if (!document.hidden) load();
}, Math.max(1, P.REFRESH_MINUTES || 5) * 60_000);

/** Prefill from the Home teaser (#q=name). The hash never reaches a server; we clear it right away. */
function readPrefill() {
  let hash = location.hash;
  try {
    if (!hash && window.parent !== window) hash = window.parent.location.hash; // Weebly export (same-origin)
  } catch {
    /* cross-origin parent */
  }
  const m = /[#&]q=([^&]*)/.exec(hash || '');
  if (!m) return '';
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* sandboxed */
  }
  return decodeURIComponent(m[1]);
}

(async () => {
  const prefill = readPrefill();
  await load();
  if (prefill && state.loaded) {
    input.value = prefill;
    const matches = searchPeople(prefill, state.people, 2);
    if (matches.length) choose(matches[0], { scroll: false });
    else renderNoResults(prefill);
  }
})();
