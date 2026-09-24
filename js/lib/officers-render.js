/* Officer + sponsor card markup. Pure string functions so the same code runs
 * in the browser (live from data/officers.json) and in tools/build.mjs
 * (pre-rendered HTML for search engines and no-JS visitors). */
import { esc, hashIndex, initials, safeUrl } from '../core/utils.js';

function avatar(person, resolvePhoto) {
  const photo = person.photo ? safeUrl(resolvePhoto(person.photo)) : '';
  const hue = hashIndex(person.name, 6);
  if (photo) {
    return `<div class="avatar avatar--photo avatar--h${hue}"><img src="${esc(photo)}" alt="" width="160" height="160" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="avatar avatar--h${hue}" aria-hidden="true"><span>${esc(initials(person.name))}</span></div>`;
}

function officerCard(person, featured, resolvePhoto) {
  return `<li class="officer${featured ? ' officer--featured' : ''}" data-reveal="stagger">
    ${avatar(person, resolvePhoto)}
    <div class="officer__text">
      <h3 class="officer__name">${esc(person.name)}</h3>
      <p class="officer__role mono">${esc(person.role || '')}</p>
    </div>
  </li>`;
}

export function renderOfficers(data, resolvePhoto = (p) => p) {
  const groups = data.groups || [];
  return groups
    .map((g, gi) => {
      const members = g.members || [];
      if (!members.length) return '';
      const id = `officer-group-${gi}`;
      return `<section class="officer-group${g.featured ? ' officer-group--featured' : ''}" aria-labelledby="${id}">
      <h2 class="officer-group__title eyebrow" id="${id}">${esc(g.title)}</h2>
      <ul class="officer-grid${g.featured ? ' officer-grid--featured' : ''}" role="list">
        ${members.map((m) => officerCard(m, g.featured, resolvePhoto)).join('')}
      </ul>
    </section>`;
    })
    .join('');
}

export function renderSponsors(data, resolvePhoto = (p) => p) {
  const sponsors = data.sponsors || [];
  return sponsors
    .map(
      (s) => `<li class="sponsor" data-reveal="stagger">
      ${avatar(s, resolvePhoto)}
      <div>
        <h3 class="sponsor__name">${esc(s.name)}</h3>
        <p class="sponsor__role">${esc(s.role || 'Club Sponsor')}</p>
        ${s.room ? `<p class="sponsor__room mono">Room ${esc(String(s.room).replace(/^room\s*/i, ''))}</p>` : ''}
      </div>
    </li>`,
    )
    .join('');
}

/** Compact sponsor list for the Contact page. */
export function renderSponsorList(data) {
  return (data.sponsors || [])
    .map((s) => `<li><strong>${esc(s.name)}</strong>${s.room ? ` · Room ${esc(String(s.room).replace(/^room\s*/i, ''))}` : ''}</li>`)
    .join('');
}
