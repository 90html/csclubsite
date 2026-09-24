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
// Stand-ins for Google (docs.google.com / googleapis.com aren't reachable from CI/sandboxes).
// The points sheet is disconnected by default; tests that need it set a URL + serve this CSV.
const MOCK_SHEET = 'Name,Meetings,Problems,Contests,Total\n"Ava M.",5,12,10,27\n"Liam C.",4,9,5,18\n"Isabella G.",5,7,5,17\n"Noah J.",1,0,0,1\n';
const sheetRoute = (r) => r.fulfill({ contentType: 'text/csv', body: MOCK_SHEET, headers: { 'access-control-allow-origin': '*' } });
const WITH_SHEET = "CONFIG.POINTS.POINTS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv';";
// A few real events from the MSA master calendar (other clubs' events must be ignored).
const MSA_ITEMS = [
  { id: 'm1', summary: 'MSA Monthly Meeting', start: { date: '2026-10-05' }, end: { date: '2026-10-06' } },
  { id: 'm2', summary: 'MSA Monthly Meeting', start: { date: '2026-11-09' }, end: { date: '2026-11-10' } },
  { id: 'm6', summary: 'MSA Monthly Meeting', start: { date: '2026-12-07' }, end: { date: '2026-12-08' } },
  { id: 'm3', summary: 'Halloween Social', description: 'Costumes! Details: https://example.com/halloween', start: { date: '2026-10-22' }, end: { date: '2026-10-23' } },
  { id: 'm4', summary: 'Digital Design Club: Session 1', start: { dateTime: '2026-10-23T15:00:00-05:00' }, end: { dateTime: '2026-10-23T16:00:00-05:00' } },
  { id: 'm5', summary: 'No School', start: { date: '2026-10-09' }, end: { date: '2026-10-10' } },
];
const msaRoute = (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: MSA_ITEMS }) });

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
const { buildPeople } = await import(pathToFileURL(join(ROOT, 'js/lib/points-data.js')).href);
const odd = buildPeople('Who,Grade Level,Pts\nAva M.,10,12\nLiam C.,11,30\n');
ok(odd.people[0].name === 'Liam C.' && odd.people[0].total === 30, 'Sheet: unknown headers fall back to first text column + last number column');

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
  // Defaults; tests can override (later routes win).
  await page.route('https://docs.google.com/**', sheetRoute);
  await page.route('https://www.googleapis.com/**', msaRoute);
  for (const [pattern, handler] of Object.entries(routes)) await page.route(pattern, handler);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

console.log('\nPages × widths (console errors, horizontal overflow)');
for (const width of [360, 768, 1440, 2560]) {
  for (const path of PAGES) {
    const { page, ctx, errors } = await open(path, { width, time: '2026-09-24T15:00:00Z' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(!errors.length && overflow <= 0, `${width}px ${path}${errors.length ? ` errors: ${errors.join(' | ')}` : ''}${overflow > 0 ? ` overflow ${overflow}px` : ''}`);
    await ctx.close();
  }
}

console.log('\nPoints (no sheet connected)');
{
  let sheetRequests = 0;
  const { page, ctx, errors } = await open('/points/', { routes: { 'https://docs.google.com/**': (r) => (sheetRequests++, sheetRoute(r)) } });
  ok(await page.locator('[data-points-soon]').isVisible(), '"Coming soon" shown');
  ok(await page.locator('[data-points-live]').first().isHidden() && (await page.locator('.board tbody tr').count()) === 0, 'No search, no leaderboard, no names');
  ok(sheetRequests === 0, 'No request to Google Sheets');
  ok((await page.locator('.rule').count()) === 7 && (await page.locator('.goal-card').innerText()).includes('7'), 'Rules + 7-point EOS goal shown');
  ok((await page.locator('.rule a[data-social="discord"]').getAttribute('href')).startsWith('https://discord.gg/') && (await page.locator('.rule a[data-social="instagram"]').getAttribute('href')).includes('instagram.com/dullescompsci'), 'Rules link to Discord + Instagram');
  ok(!errors.length, 'No console errors');
  await ctx.close();
}
{
  const { page, ctx } = await open('/');
  ok(await page.locator('[data-teaser-soon]').isVisible() && (await page.locator('[data-teaser-live]').isHidden()), 'Home teaser links to "How points work"');
  await ctx.close();
}

console.log('\nPoints (sheet connected, mocked)');
{
  const { page, ctx, errors } = await open('/points/', { config: WITH_SHEET });
  ok((await page.locator('.board tbody tr').count()) === 4, 'Rows loaded from the sheet');
  const input = page.locator('#points-q');
  for (const [q, expect] of [['isab', 'Isabella G.'], ['g isabella', 'Isabella G.'], ['isabela', 'Isabella G.'], ['liam', 'Liam C.']]) {
    await input.fill(q);
    const firstOpt = await page.locator('#points-listbox [role="option"]').first().innerText();
    ok(firstOpt.includes(expect), `dropdown "${q}" → ${expect}`);
  }
  await input.fill('ava');
  await input.press('Enter');
  await page.waitForTimeout(1300);
  ok((await page.locator('.result__name').innerText()) === 'Ava M.', 'Enter selects the top match');
  ok((await page.locator('.result__total-num').innerText()) === '27', 'Count-up finishes on the total');
  ok(/#1 of 4/i.test(await page.locator('.result__rank').innerText()), 'Rank shown');
  ok((await page.locator('.result').innerText()).includes('7-point goal'), 'EOS goal reached message');
  ok(await page.locator('tr.is-me').count() === 1, 'Selected person highlighted in leaderboard');
  await input.fill('Noah J.');
  await input.press('Enter');
  ok((await page.locator('.result').innerText()).includes('6 more to reach the 7-point'), 'Points left to the EOS goal');
  await input.fill('zzzzqx');
  await input.press('Enter');
  ok(await page.locator('.no-results').count() === 1, 'No-results state');
  await page.locator('[data-sort="total"]').click();
  ok((await page.locator('th[aria-sort]').getAttribute('aria-sort')) === 'descending', 'Sort by total');
  ok(!errors.length, 'No console errors');
  await ctx.close();
}
{
  const { page, ctx } = await open('/points/#q=isabela', { config: WITH_SHEET });
  await page.waitForTimeout(300);
  ok((await page.locator('.result__name').innerText()) === 'Isabella G.', 'Home teaser hash prefill (with typo)');
  ok(!page.url().includes('#'), 'Name is removed from the URL');
  await ctx.close();
}
{
  const csv = 'Club Points,,,,,\nName,9/3,9/10,Problems,Contest A,Contest B\n"Doe, Jane",1,1,4,10,\n  Bob Smith ,1,,2,,5\n,,,,,\nAverage,1,1,3,10,5\n';
  const config = `${WITH_SHEET}\nCONFIG.POINTS.COLUMN_GROUPS = { meetings: ['9/*'], problems: [], contests: ['Contest *'] };`;
  const { page, ctx, errors } = await open('/points/', {
    config,
    routes: { 'https://docs.google.com/**': (r) => r.fulfill({ contentType: 'text/csv', body: csv, headers: { 'access-control-allow-origin': '*' } }) },
  });
  const rowsText = await page.locator('.board tbody').innerText();
  ok(rowsText.includes('Doe, Jane') && rowsText.includes('Bob Smith') && !rowsText.includes('Average'), 'Messy CSV: header row found, junk rows skipped');
  ok(/Doe, Jane[\s\S]*\b2\b[\s\S]*\b4\b[\s\S]*\b10\b[\s\S]*\b16\b/.test(rowsText), 'Column groups summed; Total computed (2+4+10=16)');
  ok(!errors.length, 'No console errors');
  await ctx.close();
}
{
  const { page, ctx } = await open('/points/', {
    config: WITH_SHEET,
    routes: { 'https://docs.google.com/**': (r) => r.fulfill({ status: 404, body: 'nope', headers: { 'access-control-allow-origin': '*' } }) },
  });
  ok(await page.locator('[data-board] .state--error').count() === 1, 'Sheet error state with retry');
  await ctx.close();
}

console.log('\nSlides lock/unlock (9/28 meeting unlocks 4:00 PM America/Chicago)');
const sep28 = (page) => page.locator('.slide-card', { hasText: 'Sep 28, 2026' });
for (const [time, expected] of [
  ['2026-09-28T20:59:00Z', 'upcoming'],
  ['2026-09-28T21:01:00Z', 'pending'],
]) {
  const { page, ctx } = await open('/slides/', { time });
  ok((await sep28(page).getAttribute('class')).includes(`slide-card--${expected}`), `${time} → ${expected}`);
  await ctx.close();
}
{
  const { page, ctx } = await open('/slides/', {
    time: '2026-09-29T12:00:00Z',
    routes: {
      '**/data/slides.json': async (r) => {
        const json = JSON.parse(await readFile(join(ROOT, 'data/slides.json'), 'utf8'));
        json.slides.find((s) => s.date === '2026-09-28').slidesUrl = 'https://example.com/slides';
        await r.fulfill({ contentType: 'application/json', body: JSON.stringify(json) });
      },
    },
  });
  const card = sep28(page);
  ok((await card.getAttribute('class')).includes('slide-card--open'), 'Link added after the meeting → open');
  ok(await card.locator('.badge--accent').count() === 1, '"Latest" badge on newest open card');
  ok((await card.locator('.slide-card__title').innerText()) === 'Club Meeting', 'Untitled meeting shows "Club Meeting"');
  await page.fill('#slide-q', 'nothing-matches');
  await page.waitForTimeout(200);
  ok(await page.locator('.slide-grid .state').count() === 1, 'Search empty state');
  await ctx.close();
}

console.log('\nCalendar (schedule + FBISD + MSA)');
{
  const { page, ctx, errors } = await open('/calendar/', { time: '2026-09-24T15:00:00Z' });
  ok(await page.locator('.demo-banner--info').isVisible(), 'Schedule notice shown');
  ok((await page.locator('.next-card h2').innerText()) === 'Club Meeting', 'Next meeting title');
  ok((await page.locator('.next-card').innerText()).includes('Mon, Sep 28'), 'Next meeting is Mon Sep 28');
  const sep = await page.locator('.day:not(.day--out)').filter({ has: page.locator('.pill[data-type="meeting"]') }).allInnerTexts();
  ok(sep.length === 2 && sep[0].startsWith('21') && sep[1].startsWith('28'), 'September meetings: 21st and 28th');
  ok(await page.locator('.day:not(.day--out) .pill[data-type="school"]').count() === 2, 'FBISD days shown (Labor Day, 9/25)');
  await page.locator('.day:not(.day--out) .pill[data-type="meeting"]').last().click();
  ok(await page.locator('dialog.modal[open]').count() === 1, 'Event modal opens');
  ok((await page.locator('dialog.modal').innerText()).includes('Room B105'), 'Room shown');
  ok((await page.locator('dialog.modal a', { hasText: 'Add to Google Calendar' }).getAttribute('href')).startsWith('https://calendar.google.com/'), 'Add to Google Calendar link');
  const download = page.waitForEvent('download');
  await page.locator('[data-ics]').click();
  ok((await download).suggestedFilename().endsWith('.ics'), '.ics download');
  await page.keyboard.press('Escape');
  await page.locator('dialog.modal').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  ok(await page.locator('dialog.modal').count() === 0, 'Escape closes the modal');
  ok(await page.evaluate(() => document.activeElement.classList.contains('pill')), 'Focus returns to the event');

  await page.locator('[data-cal-next]').click();
  const oct = page.locator('.day:not(.day--out)');
  const octMeetings = await oct.filter({ has: page.locator('.pill[data-type="meeting"]') }).allInnerTexts();
  ok(octMeetings.length === 2 && octMeetings[0].startsWith('19') && octMeetings[1].startsWith('26'), 'October: 10/12 (fall break) moved to 10/19; 10/26 regular');
  ok(await oct.locator('.pill[data-type="msa"]').count() === 1 && (await oct.locator('.pill[data-type="social"]').count()) === 1, 'MSA meeting + Halloween Social shown');
  ok((await page.locator('.cal-shell').innerText()).includes('Digital Design') === false, 'Other clubs ignored');
  await oct.filter({ has: page.locator('.pill[data-type="meeting"]') }).first().locator('.pill[data-type="meeting"]').click();
  ok((await page.locator('dialog.modal').innerText()).includes('Moved from Mon, Oct 12 (Fall Break)'), 'Moved meeting explains why');
  await page.keyboard.press('Escape');
  await oct.locator('.pill[data-type="social"]').click();
  ok(await page.locator('dialog.modal .event-detail__desc a[href="https://example.com/halloween"]').count() === 1, 'Description links made clickable');
  await page.keyboard.press('Escape');

  await page.locator('[data-cal-next]').click();
  const nov = await page.locator('.day:not(.day--out)').filter({ has: page.locator('.pill[data-type="meeting"]') }).allInnerTexts();
  ok(nov.length === 2 && nov[0].startsWith('16') && nov[1].startsWith('30'), 'November: MSA 11/9 → 11/16, Thanksgiving 11/23 → 11/30');
  await page.locator('[data-cal-next]').click();
  const decText = await page.locator('.cal-shell').innerText();
  ok(!decText.includes('No club meeting'), 'December: no "No club meeting" entries');
  const dec = await page.locator('.day:not(.day--out)').filter({ has: page.locator('.pill[data-type="meeting"]') }).allInnerTexts();
  ok(dec.length === 1 && dec[0].startsWith('14') && dec[0].includes('Pizza Party'), 'December: 12/14 is the fall pizza party; nothing over winter break');
  for (let i = 0; i < 5; i++) await page.locator('[data-cal-next]').click();
  const may = await page.locator('.day:not(.day--out)').filter({ has: page.locator('.pill[data-type="meeting"]') }).allInnerTexts();
  ok(may.length === 1 && may[0].startsWith('10') && may[0].includes('Pizza Party'), 'May: 5/10 is the spring pizza party; no meeting in finals week');
  for (let i = 0; i < 5; i++) await page.locator('[data-cal-prev]').click();

  await page.locator('#tab-agenda').click();
  ok(await page.locator('.agenda-item').count() > 0, 'Agenda view');
  await page.locator('#tab-agenda').press('ArrowLeft');
  ok((await page.locator('#tab-month').getAttribute('aria-selected')) === 'true', 'Tabs: arrow-key navigation');
  for (let i = 0; i < 8; i++) await page.locator('[data-cal-next]').click({ force: true });
  ok((await page.locator('[data-cal-title]').innerText()) === 'May 2027' && (await page.locator('[data-cal-next]').isDisabled()), 'Stops at May 2027');
  await page.locator('[data-cal-today]').click();
  for (let i = 0; i < 3; i++) await page.locator('[data-cal-prev]').click({ force: true });
  ok((await page.locator('[data-cal-title]').innerText()) === 'August 2026' && (await page.locator('[data-cal-prev]').isDisabled()), 'Starts at August 2026');
  ok(!errors.length, 'No console errors');
  await ctx.close();
}
{
  const { page, ctx } = await open('/', { time: '2026-09-24T15:00:00Z' });
  ok((await page.locator('[data-upcoming]').innerText()).includes('Mon, Sep 28'), 'Home countdown targets Mon Sep 28');
  await ctx.close();
}
{
  const { page, ctx } = await open('/calendar/', { width: 390, time: '2026-09-24T15:00:00Z' });
  ok((await page.locator('#tab-agenda').getAttribute('aria-selected')) === 'true', 'Mobile defaults to agenda');
  await ctx.close();
}
{
  let fail = true;
  let referer = '';
  const { page, ctx } = await open('/calendar/', {
    time: '2026-09-24T15:00:00Z',
    routes: {
      'https://www.googleapis.com/**': (r) => {
        referer = r.request().headers().referer || '';
        return fail
          ? r.fulfill({ status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { message: 'Requests from referer <empty> are blocked.' } }) })
          : msaRoute(r);
      },
    },
  });
  ok(referer === `${BASE}/`, 'Sends only the site origin as referrer (for the key restriction)');
  ok(await page.locator('[data-msa-error]').isVisible(), 'MSA calendar failure: notice shown');
  ok((await page.locator('[data-msa-detail]').innerText()).includes('Requests from referer <empty> are blocked.'), "Notice shows Google's reason");
  ok((await page.locator('.next-card h2').innerText()) === 'Club Meeting', 'Meetings still shown without MSA data');
  fail = false;
  await page.locator('[data-msa-retry]').click();
  await page.waitForTimeout(500);
  ok(await page.locator('[data-msa-error]').isHidden(), 'Retry recovers once Google allows the request');
  await ctx.close();
}
{
  const { page, ctx } = await open('/calendar/', {
    config: "CONFIG.CALENDAR.CALENDAR_ID = 'club@group.calendar.google.com';",
    routes: { 'https://www.googleapis.com/**': (r) => r.fulfill({ status: 403, body: '{}', headers: { 'access-control-allow-origin': '*' } }) },
  });
  ok(await page.locator('.cal-shell .state--error [data-retry]').count() === 1, 'Club calendar error state with retry');
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
  const { page, ctx } = await open('/contact/');
  ok((await page.locator('.copy-email__addr').innerText()) === 'dullescomputerscience@gmail.com', 'Club email shown');
  ok((await page.locator('a[data-club-email]').first().getAttribute('href')) === 'mailto:dullescomputerscience@gmail.com', 'mailto link');
  ok((await page.locator('[data-remind]').innerText()).includes('@dhscs27'), 'Remind @dhscs27 shown');
  const meet = await page.locator('[data-meeting-group]').innerText();
  ok(meet.includes('Every other Monday') && meet.includes('3:00') && meet.includes('B105'), 'Meeting schedule, time and room shown');
  const sponsors = await page.locator('[data-sponsor-list]').innerText();
  ok(sponsors.includes('Mr. Rogers · Room B105') && sponsors.includes('Coach Garrett') && !sponsors.includes('A-105'), 'Sponsor rooms (no A-105 for now)');
  ok((await page.locator('main a[data-social="discord"]').getAttribute('href')) === 'https://discord.gg/YZTBQjdD6J' && (await page.locator('main a[data-social="instagram"]').isVisible()), 'Discord + Instagram links shown');
  ok(await page.locator('footer a[data-social="discord"]').isVisible() && (await page.locator('footer a[data-social="github"]').isHidden()), 'Footer socials (GitHub hidden, not set)');
  await ctx.close();
}
{
  const { page, ctx } = await open('/contact/', { config: "CONFIG.CLUB_EMAIL = 'PASTE_CLUB_EMAIL_HERE';" });
  ok(await page.locator('[data-email-missing]').isVisible(), 'Fallback when email is a placeholder');
  await ctx.close();
}
{
  const { page, ctx } = await open('/officers/');
  ok((await page.locator('.officer').count()) === 9 && (await page.locator('.sponsor').count()) === 2, '9 officers + 2 sponsors');
  ok((await page.locator('.sponsor__name').allInnerTexts()).includes('Coach Garrett'), 'Coach Garrett spelled correctly');
  ok((await page.locator('.officer--featured .officer__name').innerText()) === 'Kavish Mehta', 'President featured');
  await ctx.close();
}

console.log('\nWeebly export (srcdoc embed inside a parent page)');
for (const slug of ['1-home', '5-points', '4-calendar']) {
  const snippet = await readFile(join(ROOT, `weebly-export/${slug}.html`), 'utf8');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route('https://docs.google.com/**', sheetRoute);
  await page.route('https://www.googleapis.com/**', msaRoute);
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
