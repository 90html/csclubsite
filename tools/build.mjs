#!/usr/bin/env node
/* Build script (optional for day-to-day edits, needed after structural changes).
 *
 *   npm run build
 *
 * 1. Refreshes the shared <head>, header and footer inside every page
 *    (between <!-- @head --> … <!-- /@head --> style markers).
 * 2. Fills every <svg data-icon="name"> with its icon.
 * 3. Pre-renders the officers page from data/officers.json (for SEO/no-JS).
 * 4. Writes sitemap.xml, robots.txt and site.webmanifest from config.js.
 * 5. Generates /weebly-export/: one self-contained, paste-ready file per page. */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { footerPartial, headerPartial, headPartial, PAGES, rootFor } from './partials.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = (await import(`${pathToFileURL(join(ROOT, 'config.js')).href}?t=${Date.now()}`)).default;
const { ICON_PATHS, icon } = await import(pathToFileURL(join(ROOT, 'js/core/icons.js')).href);
const { renderOfficers, renderSponsors, renderSponsorList } = await import(pathToFileURL(join(ROOT, 'js/lib/officers-render.js')).href);
const { hashString, isPlaceholder } = await import(pathToFileURL(join(ROOT, 'js/core/utils.js')).href);
const { SOURCE: CAL_SOURCE, sourceNote } = await import(pathToFileURL(join(ROOT, 'js/lib/calendar-data.js')).href);

const SITE = String(CONFIG.SITE_URL).replace(/\/+$/, '');
const read = (p) => readFile(join(ROOT, p), 'utf8');
const write = async (p, s) => {
  await mkdir(dirname(join(ROOT, p)), { recursive: true });
  await writeFile(join(ROOT, p), s);
};

function replaceRegion(html, name, content) {
  const re = new RegExp(`(<!-- @${name} -->)[\\s\\S]*?(<!-- /@${name} -->)`);
  if (!re.test(html)) return html;
  // Replacer function: `content` may contain `$` sequences that must stay literal.
  return html.replace(re, (m, open, close) => `${open}\n${content}\n${close}`);
}

function fillIcons(html) {
  return html.replace(/<svg([^>]*?)\sdata-icon="(\w+)"([^>]*)>[\s\S]*?<\/svg>/g, (m, before, name, after) => {
    if (!ICON_PATHS[name]) throw new Error(`Unknown icon "${name}"`);
    const attrs = `${before} ${after}`;
    const cls = (/class="([^"]*)"/.exec(attrs)?.[1] || 'icon').replace(/\bicon\b\s*/, '').trim();
    return icon(name, cls).replace('<svg ', `<svg data-icon="${name}" `);
  });
}

/* ---------------------------------------------------------------- 1–3 pages */
const officers = JSON.parse(await read('data/officers.json'));
const built = {};
for (const page of PAGES) {
  let html = await read(page.file);
  html = replaceRegion(html, 'head', headPartial(page, CONFIG));
  html = replaceRegion(html, 'header', headerPartial(page));
  html = replaceRegion(html, 'footer', footerPartial(page, CONFIG));
  if (page.key === 'officers') {
    const photo = (p) => `${rootFor(page)}${p}`;
    html = replaceRegion(html, 'officers', renderOfficers(officers, photo));
    html = replaceRegion(html, 'sponsors', renderSponsors(officers, photo));
    html = html.replace(/data-officers(?: data-sig="[^"]*")?/, `data-officers data-sig="${hashString(JSON.stringify(officers))}"`);
  }
  if (page.key === 'contact') html = replaceRegion(html, 'sponsor-list', renderSponsorList(officers));
  // Bake the demo banner's visibility in (it only depends on config.js) to avoid layout shift.
  const demo = { calendar: CAL_SOURCE !== 'google', points: isPlaceholder(CONFIG.POINTS.POINTS_SHEET_URL) }[page.key];
  if (demo !== undefined) html = html.replace(/(data-demo-banner)( hidden)?/, demo ? '$1' : '$1 hidden');
  if (page.key === 'calendar') {
    html = html
      .replace(/demo-banner( demo-banner--info)? demo-banner--spaced/, `demo-banner${CAL_SOURCE === 'schedule' ? ' demo-banner--info' : ''} demo-banner--spaced`)
      .replace(/<p data-banner-text>[\s\S]*?<\/p>/, () => `<p data-banner-text>${sourceNote()}</p>`);
  }
  html = fillIcons(html);
  await write(page.file, html);
  built[page.key] = html;
}

// 404 page: absolute <base> so it works at any depth.
{
  let html = await read('404.html');
  const fake = { key: '404', file: 'index.html', path: '', title: 'Page not found · Dulles Computer Science Club', description: 'This page doesn’t exist.' };
  // The 404 page can be served at any URL depth, so pick the site root at runtime:
  // SITE_URL's path on the live host (e.g. /csclubsite/ on GitHub Pages), "/" elsewhere.
  const site = new URL(`${SITE}/`);
  const baseScript = `<script>(function(){var b=document.createElement('base');b.href=location.hostname===${JSON.stringify(site.hostname)}?${JSON.stringify(site.pathname)}:'/';document.head.appendChild(b)})()</script>`;
  html = replaceRegion(html, 'head', `${baseScript}\n${headPartial(fake, CONFIG).replace(/<link rel="canonical"[^>]*>\n/, '<meta name="robots" content="noindex">\n')}`);
  html = replaceRegion(html, 'header', headerPartial(fake));
  html = replaceRegion(html, 'footer', footerPartial(fake, CONFIG));
  await write('404.html', fillIcons(html));
}

/* ---------------------------------------------------------------- 4 meta files */
const today = new Date().toISOString().slice(0, 10);
await write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE}/${p.path}</loc><lastmod>${today}</lastmod><priority>${p.key === 'home' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`,
);
await write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /weebly-export/\n\nSitemap: ${SITE}/sitemap.xml\n`);
await write(
  'site.webmanifest',
  `${JSON.stringify(
    {
      name: CONFIG.CLUB_NAME,
      short_name: CONFIG.CLUB_SHORT_NAME,
      start_url: './',
      display: 'standalone',
      background_color: '#060a17',
      theme_color: '#060a17',
      icons: [
        { src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'assets/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )}\n`,
);

/* ---------------------------------------------------------------- 5 Weebly export */
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..600&family=Space+Grotesk:wght@500..700&display=swap';

const css = (await read('css/site.css')).replace(/@font-face\s*{[^}]*}/g, '');
const minCss = (await esbuild.transform(css, { loader: 'css', minify: true })).code;

const data = {
  'slides.json': JSON.parse(await read('data/slides.json')),
  'officers.json': officers,
  'gallery.json': JSON.parse(await read('data/gallery.json')),
};

const pageByPath = new Map(PAGES.map((p) => [`/${p.path}`, p]));
const weeblyUrl = (key) => CONFIG.WEEBLY_PAGE_URLS?.[key] || `${SITE}/${PAGES.find((p) => p.key === key).path}`;

/** Rewrite relative links: internal pages → Weebly URLs (target=_top); assets → absolute SITE_URL. */
function absolutize(html, page) {
  const pageUrl = new URL(`https://x.invalid/${page.path}`);
  return html.replace(/\s(href|src)="([^"]*)"/g, (m, attr, value) => {
    if (!value || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return m;
    const resolved = new URL(value, pageUrl);
    const target = pageByPath.get(resolved.pathname);
    if (attr === 'href' && target) {
      return ` href="${weeblyUrl(target.key)}${resolved.hash}" target="_top"`;
    }
    return ` ${attr}="${SITE}${resolved.pathname}${resolved.search}${resolved.hash}"`;
  });
}

const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
/** \u-escape non-ASCII so the snippet survives host pages with any charset. */
const asciiOnly = (js) => js.replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** Parent-page script: sizes the iframe to its content and shares the viewport with it. */
const PARENT_SCRIPT = `(function(){var f=document.getElementById(FRAME_ID);if(!f)return;
function vp(){if(!f.contentWindow)return;var r=f.getBoundingClientRect();f.contentWindow.postMessage({type:'dhscs:viewport',top:Math.max(0,-r.top),height:window.innerHeight},'*');}
window.addEventListener('message',function(e){if(e.source!==f.contentWindow)return;var d=e.data||{};
if(d.type==='dhscs:height'&&d.height>0){f.style.height=Math.ceil(d.height)+'px';vp();}
else if(d.type==='dhscs:scrollTo'){var r=f.getBoundingClientRect();window.scrollTo({top:window.pageYOffset+r.top+(+d.top||0),behavior:d.smooth?'smooth':'auto'});}
else if(d.type==='dhscs:ready'){vp();if(f.getBoundingClientRect().top<0)f.scrollIntoView();}});
window.addEventListener('scroll',vp,{passive:true});window.addEventListener('resize',vp);SETUP})();`;

function parentSnippet({ id, title, setup, iframeAttrs }) {
  return `<div style="width:100%;margin:0;padding:0;background:#060a17;border-radius:0;">
<iframe id="${id}" name="${id}" title="${title}" ${iframeAttrs} scrolling="no" allow="clipboard-write" style="display:block;width:100%;height:1200px;border:0;overflow:hidden;background:#060a17;" loading="eager"></iframe>
</div>
<script>
${PARENT_SCRIPT.replace('FRAME_ID', () => JSON.stringify(id)).replace('SETUP', () => setup)}
</script>`;
}

await rm(join(ROOT, 'weebly-export'), { recursive: true, force: true });
const hostedSnippets = [];
let n = 0;
for (const page of PAGES) {
  n++;
  const entry = join(ROOT, `js/pages/${page.key === 'gettingStarted' ? 'getting-started' : page.key}.js`);
  const bundle = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2020'],
    define: { 'import.meta.url': '""' },
    logLevel: 'error',
  });
  const js = bundle.outputFiles[0].text;

  let html = built[page.key];
  // Head: same SEO tags, Google-hosted fonts, everything else inline.
  html = html.replace(/<!-- @head -->[\s\S]*?<!-- \/@head -->/, () => {
    const head = headPartial(page, CONFIG)
      .split('\n')
      .filter((l) => !/rel="(icon|apple-touch-icon|manifest|preload|stylesheet|canonical)"/.test(l))
      .join('\n');
    return `${head}
<link rel="icon" href="${SITE}/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${GOOGLE_FONTS}">
<style>${minCss}</style>
<script>window.__DHSCS_EXPORT__=true;window.__DHSCS_DATA__=${safeScript(JSON.stringify(data))};</script>`;
  });
  html = html.replace(/<script type="module" src="[^"]*"><\/script>/, () => `<script>${safeScript(js)}</script>`);
  html = absolutize(html, page).replace(/<!-- \/?@\w+ -->\n?/g, '');

  const slug = page.key === 'gettingStarted' ? 'getting-started' : page.key;
  await write(`weebly-export/standalone/${slug}.html`, html);

  const id = `dhscs-${slug}`;
  const snippet = `<!-- DHS CS Club - ${page.nav} page - paste this whole file into a Weebly "Embed Code" element.
     Generated by \`npm run build\`. Re-run the build and re-paste after changing config.js or data files. -->
${parentSnippet({
  id,
  title: `${page.nav}: ${CONFIG.CLUB_NAME}`,
  iframeAttrs: '',
  setup: `f.srcdoc=${asciiOnly(safeScript(JSON.stringify(html)))};`,
})}
`;
  await write(`weebly-export/${n}-${slug}.html`, snippet);

  hostedSnippets.push(`<!-- ===== ${page.nav} ===== -->
${parentSnippet({ id: `${id}-hosted`, title: `${page.nav}: ${CONFIG.CLUB_NAME}`, iframeAttrs: `src="${SITE}/${page.path}"`, setup: '' })}`);
}

await write(
  'weebly-export/iframe-hosted-site.html',
  `<!-- Option A2: the site is hosted (GitHub Pages/Netlify) and shown inside Weebly.
     Paste ONE of the blocks below into a Weebly "Embed Code" element on the matching page.
     The iframe resizes itself to fit, so there's no double scrollbar. -->
${hostedSnippets.join('\n\n')}
`,
);

const sizes = await Promise.all(
  PAGES.map(async (p, i) => {
    const slug = p.key === 'gettingStarted' ? 'getting-started' : p.key;
    const s = await read(`weebly-export/${i + 1}-${slug}.html`);
    return `${slug}: ${(s.length / 1024).toFixed(0)} KB`;
  }),
);
console.log(`✓ Built ${PAGES.length} pages, sitemap, robots, manifest.\n✓ Weebly export → weebly-export/ (${sizes.join(', ')})`);
