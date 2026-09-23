/* Placeholder checklist, shown only when a page URL ends in ?setup. */
import CONFIG from '../../config.js';
import { esc, isPlaceholder } from './utils.js';

const CHECKS = [
  ['Club email', 'CLUB_EMAIL', () => CONFIG.CLUB_EMAIL],
  ['Meeting day', 'MEETING.day', () => CONFIG.MEETING.day],
  ['Meeting time', 'MEETING.time', () => CONFIG.MEETING.time],
  ['Meeting room', 'MEETING.room', () => CONFIG.MEETING.room],
  ['Google Calendar ID', 'CALENDAR.CALENDAR_ID', () => CONFIG.CALENDAR.CALENDAR_ID],
  ['Google Calendar API key', 'CALENDAR.CALENDAR_API_KEY', () => CONFIG.CALENDAR.CALENDAR_API_KEY],
  ['Points sheet (published CSV)', 'POINTS.POINTS_SHEET_URL', () => CONFIG.POINTS.POINTS_SHEET_URL],
  ['Points per meeting', 'POINTS.POINT_VALUES.meeting', () => CONFIG.POINTS.POINT_VALUES.meeting],
  ['Points per problem', 'POINTS.POINT_VALUES.problem', () => CONFIG.POINTS.POINT_VALUES.problem],
  ['Points per contest', 'POINTS.POINT_VALUES.contest', () => CONFIG.POINTS.POINT_VALUES.contest],
];

export function showSetupPanel() {
  const rows = CHECKS.map(([label, key, get]) => {
    const done = !isPlaceholder(get());
    return `<li class="${done ? 'is-done' : ''}"><span aria-hidden="true">${done ? '✓' : '•'}</span>
      <span>${esc(label)} <code>${esc(key)}</code></span><span class="sr-only">${done ? 'filled in' : 'still a placeholder'}</span></li>`;
  }).join('');
  const panel = document.createElement('aside');
  panel.className = 'setup-panel';
  panel.setAttribute('aria-label', 'Site setup checklist');
  panel.innerHTML = `
    <div class="setup-panel__head"><strong>Setup checklist</strong>
      <button type="button" class="icon-btn" aria-label="Close setup checklist">×</button></div>
    <p>Edit these in <code>config.js</code>. Only you see this panel (it appears because the URL has <code>?setup</code>).</p>
    <ul>${rows}</ul>`;
  panel.querySelector('button').addEventListener('click', () => panel.remove());
  document.body.append(panel);
}
