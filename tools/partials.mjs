/* Shared page chrome (head, header, footer) used by tools/build.mjs.
 * Edit page titles/descriptions in PAGES below, then run `npm run build`. */

export const PAGES = [
  {
    key: 'home',
    file: 'index.html',
    path: '',
    nav: 'Home',
    title: 'Dulles Computer Science Club: Learn to Code, Compete, Build',
    description:
      'The Dulles High School Computer Science Club: weekly meetings, Java from zero, competitive programming and UIL contests. Beginners welcome.',
  },
  {
    key: 'gettingStarted',
    file: 'getting-started/index.html',
    path: 'getting-started/',
    nav: 'Getting Started',
    title: 'Getting Started · Dulles Computer Science Club',
    description:
      'New to coding or contests? Four simple steps to join the DHS CS Club, set up Java, learn the basics and start solving problems.',
  },
  {
    key: 'slides',
    file: 'slides/index.html',
    path: 'slides/',
    nav: 'Slides',
    title: 'Meeting Slides · Dulles Computer Science Club',
    description: 'Slides from every DHS CS Club meeting, posted right after each meeting. Filter by topic and catch up on anything you missed.',
  },
  {
    key: 'calendar',
    file: 'calendar/index.html',
    path: 'calendar/',
    nav: 'Calendar',
    title: 'Calendar · Dulles Computer Science Club',
    description: 'Upcoming DHS CS Club meetings, contests, workshops and socials, plus a countdown to the next meeting.',
  },
  {
    key: 'points',
    file: 'points/index.html',
    path: 'points/',
    nav: 'Points',
    title: 'Points & Leaderboard · Dulles Computer Science Club',
    description: 'Look up your DHS CS Club points for meetings, problems and contests, and see the live leaderboard.',
  },
  {
    key: 'officers',
    file: 'officers/index.html',
    path: 'officers/',
    nav: 'Officers',
    title: 'Officers · Dulles Computer Science Club',
    description: 'Meet the student officers and faculty sponsors who run the Dulles High School Computer Science Club.',
  },
  {
    key: 'contact',
    file: 'contact/index.html',
    path: 'contact/',
    nav: 'Contact',
    title: 'Contact · Dulles Computer Science Club',
    description: 'Get in touch with the Dulles High School Computer Science Club.',
  },
];

let markId = 0;
/** The club logo mark: a gradient </> in a rounded tile. */
export function logoMark(cls = 'brand__mark') {
  const id = `lg${++markId}`;
  return `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bd1a3a"/><stop offset=".5" stop-color="#d4213f"/><stop offset="1" stop-color="#f0506a"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="11" fill="#0c1530" stroke="url(#${id})" stroke-width="1.5"/><path d="M14.5 13.5 8.5 20l6 6.5M25.5 13.5l6 6.5-6 6.5M22.5 11.5l-5 17" fill="none" stroke="url(#${id})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Relative prefix from a page to the site root ("" or "../"). */
export const rootFor = (page) => '../'.repeat(page.file.split('/').length - 1);

/** @param {string} [iconVersion] cache-buster so browsers pick up a new favicon */
export function headPartial(page, config, iconVersion = '') {
  const root = rootFor(page);
  const v = iconVersion ? `?v=${iconVersion}` : '';
  const site = String(config.SITE_URL).replace(/\/+$/, '');
  const url = `${site}/${page.path}`;
  const og = `${site}/assets/og-image.png`;
  const ld =
    page.key === 'home'
      ? `\n<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name: config.CLUB_NAME,
          alternateName: config.CLUB_SHORT_NAME,
          url: `${site}/`,
          logo: `${site}/assets/icons/icon-512.png`,
          description: page.description,
          parentOrganization: {
            '@type': 'HighSchool',
            name: config.SCHOOL.name,
            address: { '@type': 'PostalAddress', addressLocality: config.SCHOOL.location.split(',')[0].trim(), addressRegion: (config.SCHOOL.location.split(',')[1] || '').trim(), addressCountry: 'US' },
          },
        })}</script>`
      : '';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#060a17">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.CLUB_NAME)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(og)}${v}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dulles Computer Science Club: learn to code, compete, build.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${esc(og)}${v}">
<link rel="icon" href="${root}assets/icons/favicon.svg${v}" type="image/svg+xml">
<link rel="icon" href="${root}assets/icons/favicon-32.png${v}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${root}assets/icons/apple-touch-icon.png${v}">
<link rel="manifest" href="${root}site.webmanifest">
<link rel="preload" href="${root}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}css/site.css">
<script>document.documentElement.classList.add('js')</script>${ld}`;
}

export function headerPartial(page) {
  const root = rootFor(page);
  const href = (p) => `${root}${p.path}` || './';
  const current = (p) => (p.key === page.key ? ' aria-current="page"' : '');
  const links = PAGES.map((p) => `<a href="${href(p)}"${current(p)}>${p.nav}</a>`).join('\n        ');
  const drawerLinks = PAGES.map((p) => `<li><a href="${href(p)}"${current(p)}>${p.nav}</a></li>`).join('\n        ');
  const cal = PAGES.find((p) => p.key === 'calendar');
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${href(PAGES[0])}" aria-label="DHS CS Club: home">
      ${logoMark()}
      <span>DHS <span class="grad-text">CS</span> Club</span>
    </a>
    <nav class="nav-links" aria-label="Main">
      <span class="nav-pill" aria-hidden="true"></span>
        ${links}
    </nav>
    <a class="btn btn--primary btn--sm header-cta" href="${href(cal)}">Join a Meeting</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-drawer" aria-label="Open menu">
      <svg class="icon icon-menu" data-icon="menu"></svg><svg class="icon icon-close" data-icon="x"></svg>
    </button>
  </div>
</header>
<div class="nav-drawer" id="nav-drawer" hidden>
  <div class="nav-drawer__panel">
    <nav aria-label="Mobile">
      <ul>
        ${drawerLinks}
      </ul>
    </nav>
    <a class="btn btn--primary btn--lg" href="${href(cal)}" data-close-drawer>Join a Meeting <svg class="icon" data-icon="arrowRight"></svg></a>
  </div>
</div>`;
}

export function footerPartial(page, config) {
  const root = rootFor(page);
  const href = (p) => `${root}${p.path}` || './';
  const links = PAGES.map((p) => `<li><a href="${href(p)}">${p.nav}</a></li>`).join('\n          ');
  const contact = PAGES.find((p) => p.key === 'contact');
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer__grid">
      <div class="footer__about">
        <a class="brand" href="${href(PAGES[0])}" aria-label="DHS CS Club: home">${logoMark()}<span>${esc(config.CLUB_NAME)}</span></a>
        <p>The computer science club at ${esc(config.SCHOOL.name)}, ${esc(config.SCHOOL.location)}. Learn to code, solve problems, and compete. Beginners are always welcome.</p>
      </div>
      <div>
        <p class="footer__title">Explore</p>
        <ul class="footer__links">
          ${links}
        </ul>
      </div>
      <div>
        <p class="footer__title">Get in touch</p>
        <div class="footer__contact">
          <a href="#" data-club-email hidden><svg class="icon" data-icon="mail"></svg><span data-club-email-text></span></a>
          <a href="${href(contact)}"><svg class="icon" data-icon="arrowRight"></svg>Contact page</a>
          <div class="socials" data-social-list hidden>
            <a class="icon-btn" data-social="instagram" href="#" target="_blank" rel="noopener" hidden aria-label="Instagram"><svg class="icon" data-icon="instagram"></svg></a>
            <a class="icon-btn" data-social="github" href="#" target="_blank" rel="noopener" hidden aria-label="GitHub"><svg class="icon" data-icon="github"></svg></a>
            <a class="icon-btn" data-social="discord" href="#" target="_blank" rel="noopener" hidden aria-label="Discord"><svg class="icon" data-icon="discord"></svg></a>
          </div>
        </div>
      </div>
    </div>
    <div class="footer__bottom">
      <span>© <span data-year>${new Date().getFullYear()}</span> ${esc(config.CLUB_NAME)} · ${esc(config.SCHOOL.name)}</span>
      <span class="mono">Built by the DHS CS Club</span>
    </div>
  </div>
</footer>`;
}
