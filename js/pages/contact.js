/* Contact: copy-to-clipboard email, Remind code, sponsor rooms. */
import CONFIG from '../../config.js';
import { copyText, initApp, toast } from '../core/app.js';
import { loadData } from '../core/site.js';
import { isPlaceholder } from '../core/utils.js';
import { renderSponsorList } from '../lib/officers-render.js';

initApp();

const email = CONFIG.CLUB_EMAIL;
const hasEmail = !isPlaceholder(email);
document.querySelector('[data-email-ready]').hidden = !hasEmail;
document.querySelector('[data-email-missing]').hidden = hasEmail;

const copyBtn = document.querySelector('[data-copy-email]');
if (hasEmail) {
  // Allow a line break only after the "@" on narrow screens.
  const [user, domain] = email.split('@');
  copyBtn.querySelector('.copy-email__addr').replaceChildren(`${user}@`, document.createElement('wbr'), domain || '');
}
const label = copyBtn.querySelector('[data-copy-label]');
const status = document.getElementById('copy-status');
let resetTimer;
copyBtn.addEventListener('click', async () => {
  const ok = await copyText(email);
  clearTimeout(resetTimer);
  copyBtn.classList.toggle('is-copied', ok);
  label.textContent = ok ? 'Copied!' : 'Copy';
  status.textContent = ok ? 'Email address copied to clipboard.' : '';
  if (ok) toast('Email copied to clipboard.', 'success');
  else toast(`Couldn't copy automatically. The address is ${email}.`);
  resetTimer = setTimeout(() => {
    copyBtn.classList.remove('is-copied');
    label.textContent = 'Copy';
  }, 2500);
});

const remind = document.querySelector('[data-remind]');
if (!isPlaceholder(CONFIG.REMIND_CODE)) {
  remind.querySelector('[data-remind-code]').textContent = CONFIG.REMIND_CODE;
  remind.hidden = false;
}

// Keep sponsor rooms in sync with data/officers.json (pre-rendered at build time).
loadData('officers.json')
  .then((data) => {
    const html = renderSponsorList(data);
    if (html) document.querySelector('[data-sponsor-list]').innerHTML = html;
  })
  .catch(() => {});
