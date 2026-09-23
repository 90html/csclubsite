#!/usr/bin/env node
/* Generates the favicon set and the Open Graph share image.
 *
 *   npm run brand
 *
 * Icons are rendered from SVG with sharp; the OG image is rendered in headless
 * Chromium so it uses the site's real fonts. Only needed if you change the logo. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'assets/icons');
await mkdir(ICONS, { recursive: true });

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bd1a3a"/><stop offset=".5" stop-color="#d4213f"/><stop offset="1" stop-color="#f0506a"/></linearGradient>`;
const GLYPH = (stroke) => `<path d="M14.5 13.5 8.5 20l6 6.5M25.5 13.5l6 6.5-6 6.5M22.5 11.5l-5 17" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Rounded-tile logo (favicon, touch icons). */
const tile = (stroke = 2.6) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs>${GRAD}</defs><rect x="1" y="1" width="38" height="38" rx="11" fill="#0c1530" stroke="url(#g)" stroke-width="1.5"/>${GLYPH(stroke)}</svg>`;
/** Full-bleed version with safe-zone padding (maskable PWA icon). */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 60 60"><defs>${GRAD}</defs><rect x="-10" y="-10" width="60" height="60" fill="#081026"/>${GLYPH(2.6)}</svg>`;

await writeFile(join(ICONS, 'favicon.svg'), tile(3));
const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 1024 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ICONS, file));
await png(tile(3.2), 32, 'favicon-32.png');
await png(tile(), 180, 'apple-touch-icon.png');
await png(tile(), 192, 'icon-192.png');
await png(tile(), 512, 'icon-512.png');
await png(maskable, 512, 'icon-maskable-512.png');

/* ---------- Open Graph image (1200×630) ---------- */
const fonts = {};
for (const f of ['space-grotesk-latin.woff2', 'inter-latin.woff2', 'jetbrains-mono-latin.woff2']) {
  fonts[f] = `data:font/woff2;base64,${(await readFile(join(ROOT, 'assets/fonts', f))).toString('base64')}`;
}
const fontUrl = (f) => fonts[f];
const og = `<!doctype html><html><head><style>
@font-face{font-family:SG;src:url(${fontUrl('space-grotesk-latin.woff2')});font-weight:500 700}
@font-face{font-family:IN;src:url(${fontUrl('inter-latin.woff2')});font-weight:400 700}
@font-face{font-family:JB;src:url(${fontUrl('jetbrains-mono-latin.woff2')});font-weight:400 600}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#060a17;color:#eef1f8;font-family:IN;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 75% 80% at 70% 40%,#000 30%,transparent 80%)}
.orb{position:absolute;border-radius:50%;filter:blur(90px)}
.o1{width:620px;height:620px;right:-120px;top:-260px;background:#1f46d1;opacity:.5}
.o2{width:560px;height:560px;left:-200px;bottom:-320px;background:#16296e;opacity:.6}
.o3{width:360px;height:360px;left:520px;top:260px;background:#2a44a8;opacity:.16}
.wrap{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:18px;font-family:SG;font-weight:700;font-size:30px}
.brand svg{width:64px;height:64px}
.muted{color:#8e9ab8;font-weight:500}
h1{margin-top:auto;font-family:SG;font-weight:700;font-size:92px;line-height:.98;letter-spacing:-.045em}
.g{background:linear-gradient(100deg,#bd1a3a,#d4213f 50%,#e8354f);-webkit-background-clip:text;color:transparent}
.row{margin-top:34px;display:flex;gap:14px;font-family:JB;font-size:22px}
.chip{padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#cfd6ea}
.code{position:absolute;right:80px;top:150px;font-family:JB;font-size:22px;line-height:1.7;color:#6b7699;white-space:pre}
.code b{color:#f5657c;font-weight:400}.code i{color:#c3e88d;font-style:normal}
</style></head><body><div class="grid"></div><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
<div class="code">// Dulles High School
<b>class</b> Club {
  goals = {<i>"learn"</i>, <i>"solve"</i>, <i>"compete"</i>};
}</div>
<div class="wrap"><div class="brand">${tile()}<span>DHS CS Club <span class="muted">· Dulles High School</span></span></div>
<h1>Where Dulles learns<br>to <span class="g">think in code.</span></h1>
<div class="row"><span class="chip">Java</span><span class="chip">Competitive programming</span><span class="chip">UIL contests</span><span class="chip">Beginners welcome</span></div></div>
</body></html>`;

const browser = await chromium.launch({ executablePath: findChrome() });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ type: 'png' });
await browser.close();
await sharp(shot).png({ compressionLevel: 9, palette: false }).toFile(join(ROOT, 'assets/og-image.png'));
console.log('✓ Icons → assets/icons/, OG image → assets/og-image.png');
