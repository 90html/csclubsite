/* Officers: the HTML is pre-rendered by the build script (fast, SEO-friendly).
 * If data/officers.json was edited since the last build, re-render from it so
 * changes show up without rebuilding. */
import { initApp, observeReveal } from '../core/app.js';
import { assetUrl, loadData } from '../core/site.js';
import { hashString } from '../core/utils.js';
import { renderOfficers, renderSponsors } from '../lib/officers-render.js';

initApp();

(async () => {
  const officers = document.querySelector('[data-officers]');
  try {
    const data = await loadData('officers.json');
    if (officers.dataset.sig === hashString(JSON.stringify(data))) return; // already up to date
    officers.innerHTML = renderOfficers(data, assetUrl);
    document.querySelector('[data-sponsors]').innerHTML = renderSponsors(data, assetUrl);
    observeReveal();
  } catch {
    /* keep the pre-rendered roster */
  }
})();
