#!/usr/bin/env node
/* End-to-end checks in headless Chromium:  npm test
 * Starts the local server, then checks every page at several widths plus the
 * interactive features (points search, slide locking, calendar, drawer,
 * config-driven states and the Weebly embeds). */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;
const PAGES = ['/', '/getting-started/', '/slides/', '/calendar/', '/points/', '/officers/', '/contact/', '/404.html'];

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`);
  if (!cond) failures++;
};

/* ---------------- Unit checks (Node) ---------------- */
console.log('Unit');
const { parseCSV } = await import(pathToFileURL(join(ROOT, 'js/lib/csv.js')).href);
const rows = parseCSV('﻿Name,Notes\r\n"Doe, Jane","said ""hi"""\n\n  Bob  ,x,\n');
ok(rows[1][0] === 'Doe, Jane' && rows[1][1] === 'said "hi"', 'CSV: quoted commas and escaped quotes');
ok(rows[3][0] === 'Bob' && rows.length === 4, 'CSV: whitespace trimmed, blank line kept as empty row');
const { searchPeople } = await import(pathToFileURL(join(ROOT, 'js/lib/fuzzy.js')).href);
const people = ['Ava Martinez', 'Isabella García', 'Zoë Anderson', 'Ryan O’Connor', 'Liam Chen'].map((name) => ({ name }));
const first = (q) => searchPeople(q, people, 1)[0]?.name;
ok(first('isa') === 'Isabella García', 'Search: partial first name');
ok(first('garcia isabella') === 'Isabella García', 'Search: reversed order + accent-insensitive');
ok(first('isabela') === 'Isabella García', 'Search: typo tolerance');
ok(first('zoe') === 'Zoë Anderson', 'Search: diacritics');
ok(first('  AVA   martinez ') === 'Ava Martinez', 'Search: whitespace + case');
ok(first('oconnor') === 'Ryan O’Connor', 'Search: punctuation-insensitive');
ok(!first('qqqq'), 'Search: no false positives');

/* ---------------- Browser checks ---------------- */
const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ executablePath: findChrome() });

async function open(path, { width = 1280, height = 900, config, time, routes = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  if (time) await page.clock.install({ time: new Date(time) });
  if (config) {
    const base = await readFile(join(ROOT, 'config.js'), 'utf8');
    await page.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `${base}\n${config}` }));
  }
  for (const [pattern, handler] of Object.entries(routes)) await page.route(pattern, handler);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

console.log('\nPages × widths (console errors, horizontal overflow)');
for (const width of [360, 768, 1440, 2560]) {
  for (const path of PAGES) {
    const { page, ctx, errors } = await open(path, { width });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(!errors.length && overflow <= 0, `${width}px ${path}${errors.length ? ` errors: ${errors.join(' | ')}` : ''}${overflow > 0 ? ` overflow ${overflow}px` : ''}`);
    await ctx.close();
  }
}

console.log('\nPoints (demo data)');
{
  const { page, ctx } = await open('/points/');
  const input = page.locator('#points-q');
  for (const [q, expect] of [['kowal', 'Ella Kowalski'], ['kowalski ella', 'Ella Kowalski'], ['elaa kowalsky', 'Ella Kowalski'], ['garcia', 'Isabella García']]) {
    await input.fill(q);
    const firstOpt = await page.locator('#points-listbox [role="option"]').first().innerText();
    ok(firstOpt.includes(expect), `dropdown "${q}" → ${expect}`);
  }
  await input.fill('kowalski ella');
  await input.press('Enter');
  await page.waitForTimeout(1300);
  ok((await page.locator('.result__name').innerText()) === 'Ella Kowalski', 'Enter selects the top match');
  ok((await page.locator('.result__total-num').innerText()) === '64', 'Count-up finishes on the total');
  ok(/#1 of 48/i.test(await page.locator('.result__rank').innerText()), 'Rank "#1 of 48" shown');
  ok(await page.locator('tr.is-me').count() === 1, 'Selected person highlighted in leaderboard');
  await input.fill('Jack Wilson');
  await input.press('Enter');
  ok((await page.locator('.result__next').innerText()).includes('to reach #4'), '"Points to next rank" shown');
  await input.fill('zzzzqx');
  await input.press('Enter');
  ok(await page.locator('.no-results').count() === 1, 'No-results state');
  await page.locator('[data-sort="total"]').click();
  ok((await page.locator('th[aria-sort]').getAttribute('aria-sort')) === 'descending', 'Sort by total');
  await page.locator('[data-page="1"]').click();
  ok((await page.locator('.pager span').first().innerText()).startsWith('Showing 26'), 'Pagination');
  await ctx.close();
}
{
  const { page, ctx } = await open('/points/#q=isabela');
  await page.waitForTimeout(300);
  ok((await page.locator('.result__name').innerText()) === 'Isabella García', 'Home teaser hash prefill (with typo)');
  ok(!page.url().includes('#'), 'Name is removed from the URL');
  await ctx.close();
}

console.log('\nPoints (real CSV with messy data + column groups)');
{
  const csv = 'Club Points,,,,,\nName,9/3,9/10,Problems,Contest A,Contest B\n"Doe, Jane",1,1,4,10,\n  Bob Smith ,1,,2,,5\n,,,,,\nAverage,1,1,3,10,5\n';
  const config = `CONFIG.POINTS.POINTS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv';
CONFIG.POINTS.COLUMN_GROUPS = { meetings: ['9/*'], problems: [], contests: ['Contest *'] };`;
  const { page, ctx, errors } = await open('/points/', {
    config,
    routes: { 'https://docs.google.com/**': (r) => r.fulfill({ contentType: 'text/csv', body: csv, headers: { 'access-control-allow-origin': '*' } }) },
  });
  const rowsText = await page.locator('.board tbody').innerText();
  ok(rowsText.includes('Doe, Jane') && rowsText.includes('Bob Smith') && !rowsText.includes('Average'), 'Header row found, junk rows skipped');
  ok(/Doe, Jane[\s\S]*\b2\b[\s\S]*\b4\b[\s\S]*\b10\b[\s\S]*\b16\b/.test(rowsText), 'Column groups summed; Total computed (2+4+10=16)');
  ok(await page.locator('[data-demo-banner]').isHidden(), 'Demo banner hidden with a real sheet');
  ok(!errors.length, 'No console errors');
  await ctx.close();
}
{
  const { page, ctx } = await open('/points/', {
    config: "CONFIG.POINTS.POINTS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/BROKEN/pub?output=csv';",
    routes: { 'https://docs.google.com/**': (r) => r.fulfill({ status: 404, body: 'nope', headers: { 'access-control-allow-origin': '*' } }) },
  });
  ok(await page.locator('[data-board] .state--error').count() === 1, 'Sheet error state with retry');
  await ctx.close();
}

console.log('\nSlides lock/unlock (sample entry dated 2026-09-24, unlocks 17:00 America/Chicago)');
for (const [time, expected] of [
  ['2026-09-24T21:59:00Z', 'upcoming'],
  ['2026-09-24T22:01:00Z', 'pending'],
]) {
  const { page, ctx } = await open('/slides/', { time });
  const cls = await page.locator('.slide-card', { hasText: 'String Manipulation' }).getAttribute('class');
  ok(cls.includes(`slide-card--${expected}`), `${time} → ${expected}`);
  await ctx.close();
}
{
  const { page, ctx } = await open('/slides/', {
    time: '2026-09-25T12:00:00Z',
    routes: {
      '**/data/slides.json': async (r) => {
        const json = JSON.parse(await readFile(join(ROOT, 'data/slides.json'), 'utf8'));
        json.slides.find((s) => s.id === '2026-09-24-strings').slidesUrl = 'https://example.com/slides';
        await r.fulfill({ contentType: 'application/json', body: JSON.stringify(json) });
      },
    },
  });
  const card = page.locator('.slide-card', { hasText: 'String Manipulation' });
  ok((await card.getAttribute('class')).includes('slide-card--open'), 'Link added after the meeting → open');
  ok(await card.locator('.badge--accent').count() === 1, '"Latest" badge on newest open card');
  await page.locator('.chip', { hasText: 'UIL' }).click();
  ok(await page.locator('.slide-grid .slide-card').count() === 1, 'Topic filter');
  await page.locator('.chip', { hasText: 'All topics' }).click();
  await page.fill('#slide-q', 'nothing-matches');
  await page.waitForTimeout(200);
  ok(await page.locator('.slide-grid .state').count() === 1, 'Search empty state');
  await ctx.close();
}

console.log('\nCalendar');
{
  const { page, ctx } = await open('/calendar/', { time: '2026-09-23T15:00:00Z' });
  ok((await page.locator('[data-cal-title]').innerText()) === 'September 2026', 'Month title');
  ok(await page.locator('.day--today').count() === 1, 'Today highlighted');
  ok(await page.locator('.next-card .countdown').count() === 1, 'Next meeting countdown');
  await page.locator('.pill').first().click();
  ok(await page.locator('dialog.modal[open]').count() === 1, 'Event modal opens');
  ok((await page.locator('dialog.modal a', { hasText: 'Add to Google Calendar' }).getAttribute('href')).startsWith('https://calendar.google.com/'), 'Add to Google Calendar link');
  ok(await page.locator('dialog.modal .event-detail__desc a[href^="https://codingbat.com"]').count() === 1, 'Description links made clickable');
  const download = page.waitForEvent('download');
  await page.locator('[data-ics]').click();
  ok((await download).suggestedFilename().endsWith('.ics'), '.ics download');
  await page.keyboard.press('Escape');
  await page.locator('dialog.modal').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  ok(await page.locator('dialog.modal').count() === 0, 'Escape closes the modal');
  ok(await page.evaluate(() => document.activeElement.classList.contains('pill')), 'Focus returns to the event');
  await page.locator('#tab-agenda').click();
  ok(await page.locator('.agenda-item').count() > 0, 'Agenda view');
  await page.locator('#tab-agenda').press('ArrowLeft');
  ok((await page.locator('#tab-month').getAttribute('aria-selected')) === 'true', 'Tabs: arrow-key navigation');
  await page.locator('[data-cal-next]').click();
  ok((await page.locator('[data-cal-title]').innerText()) === 'October 2026', 'Next month');
  await ctx.close();
}
{
  const { page, ctx } = await open('/calendar/', { width: 390 });
  ok((await page.locator('#tab-agenda').getAttribute('aria-selected')) === 'true', 'Mobile defaults to agenda');
  await ctx.close();
}
{
  const { page, ctx } = await open('/calendar/', {
    config: "CONFIG.CALENDAR.CALENDAR_ID = 'x@group.calendar.google.com'; CONFIG.CALENDAR.CALENDAR_API_KEY = 'bad';",
    routes: { 'https://www.googleapis.com/**': (r) => r.fulfill({ status: 403, body: '{}', headers: { 'access-control-allow-origin': '*' } }) },
  });
  ok(await page.locator('.cal-shell .state--error [data-retry]').count() === 1, 'API error state with retry');
  ok(await page.locator('[data-demo-banner]').isHidden(), 'No demo banner once configured');
  await ctx.close();
}
{
  const item = (id, summary, start, end) => ({ id, summary, status: 'confirmed', start, end });
  const { page, ctx } = await open('/calendar/', {
    time: '2026-09-23T15:00:00Z',
    config: "CONFIG.CALENDAR.CALENDAR_ID = 'x@group.calendar.google.com'; CONFIG.CALENDAR.CALENDAR_API_KEY = 'key';",
    routes: {
      'https://www.googleapis.com/**': (r) =>
        r.fulfill({
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            items: [
              item('a', 'UIL District Contest', { date: '2026-09-28' }, { date: '2026-09-30' }),
              item('b', 'Weekly Meeting', { dateTime: '2026-09-24T16:15:00-05:00' }, { dateTime: '2026-09-24T17:15:00-05:00' }),
            ],
          }),
        }),
    },
  });
  ok(await page.locator('.pill[data-type="contest"]').count() === 2, 'Multi-day all-day event spans 2 days, typed "contest"');
  ok((await page.locator('.next-card h2').innerText()) === 'Weekly Meeting', 'Next meeting from API data');
  await ctx.close();
}

console.log('\nNav, contact, officers');
{
  const { page, ctx } = await open('/', { width: 390 });
  await page.locator('.nav-toggle').click();
  ok(await page.locator('#nav-drawer').isVisible(), 'Mobile drawer opens');
  ok(await page.evaluate(() => document.getElementById('main').inert), 'Page behind the drawer is inert');
  await page.keyboard.press('Escape');
  ok(await page.locator('#nav-drawer').isHidden(), 'Escape closes drawer');
  ok(await page.evaluate(() => document.activeElement.classList.contains('nav-toggle')), 'Focus returns to menu button');
  await ctx.close();
}
{
  const { page, ctx } = await open('/contact/', { config: "CONFIG.CLUB_EMAIL = 'club@example.com'; CONFIG.REMIND_CODE = '@dhscs26';" });
  ok((await page.locator('.copy-email__addr').innerText()) === 'club@example.com', 'Email shown when configured');
  ok((await page.locator('a[data-club-email]').first().getAttribute('href')) === 'mailto:club@example.com', 'mailto link');
  ok(await page.locator('[data-remind]').isVisible(), 'Remind shown when configured');
  await ctx.close();
}
{
  const { page, ctx } = await open('/contact/');
  ok(await page.locator('[data-email-missing]').isVisible(), 'Fallback when email is a placeholder');
  await ctx.close();
}
{
  const { page, ctx } = await open('/officers/');
  ok((await page.locator('.officer').count()) === 9 && (await page.locator('.sponsor').count()) === 2, '9 officers + 2 sponsors');
  ok((await page.locator('.officer--featured .officer__name').innerText()) === 'Kavish Mehta', 'President featured');
  await ctx.close();
}

console.log('\nWeebly export (srcdoc embed inside a parent page)');
for (const slug of ['1-home', '5-points', '4-calendar']) {
  const snippet = await readFile(join(ROOT, `weebly-export/${slug}.html`), 'utf8');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  // Serve the snippet from a fake Weebly page on our local server's origin.
  await page.route(`${BASE}/__weebly-test`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0;background:#fff"><div style="height:300px">Weebly header</div>${snippet}<div style="height:300px">Weebly footer</div></body></html>` }));
  await page.goto(`${BASE}/__weebly-test`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => parseInt(document.querySelector('iframe').style.height, 10));
  const frame = page.frames().find((f) => f !== page.mainFrame());
  const inner = await frame.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  ok(Math.abs(h - inner) <= 2 && h > 900, `${slug}: iframe auto-sized to content (${h}px)`);
  ok((await frame.locator('.nav-links a').first().getAttribute('target')) === '_top', `${slug}: nav links target _top`);
  ok(!errors.length, `${slug}: no script errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
server.kill();
console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ All checks passed');
process.exit(failures ? 1 : 0);
