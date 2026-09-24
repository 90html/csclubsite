/* Points data: fetch the published Google Sheet (CSV), map columns (with
 * auto-detection + column groups), compute totals and ranks.
 * Nothing here logs or sends names anywhere. */
import CONFIG from '../../config.js';
import { isPlaceholder } from '../core/utils.js';
import { parseCSV } from './csv.js';

const P = CONFIG.POINTS;
/** False while no points sheet is connected (the Points page shows "coming soon"). */
export const HAS_SHEET = !isPlaceholder(P.POINTS_SHEET_URL);
export const CATEGORIES = ['meetings', 'problems', 'contests'];

const SYNONYMS = {
  name: ['name', 'full name', 'student', 'student name', 'member', 'member name', 'first name'],
  meetings: ['meetings', 'meeting', 'attendance', 'meeting points', 'attended'],
  problems: ['problems', 'problem', 'problems solved', 'solved', 'problem points'],
  contests: ['contests', 'contest', 'competitions', 'contest points'],
  total: ['total', 'total points', 'points', 'score', 'overall'],
};

/** Accept a published CSV link, a /pubhtml link, or a normal Sheets link. */
export function toCsvUrl(input) {
  const url = String(input || '').trim();
  if (/output=csv|format=csv|tqx=out:csv/i.test(url)) return url;
  // Published: /spreadsheets/d/e/<key>/pubhtml  →  /pub?output=csv
  const pub = /\/spreadsheets\/d\/e\/([\w-]+)\/pub(?:html)?/.exec(url);
  if (pub) {
    const gid = /[?&#]gid=(\d+)/.exec(url);
    return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${gid[1]}&single=true` : ''}`;
  }
  // Normal: /spreadsheets/d/<id>/edit#gid=0  →  gviz CSV endpoint
  const normal = /\/spreadsheets\/d\/([\w-]+)/.exec(url);
  if (normal) {
    const gid = /[?&#]gid=(\d+)/.exec(url);
    return `https://docs.google.com/spreadsheets/d/${normal[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid[1]}` : ''}`;
  }
  return url;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9/*]+/g, ' ').trim();

/** Robust number parsing: "12", " 12 ", "1,234", "12.5", "", "—" → number. */
function num(v) {
  const s = String(v ?? '').replace(/[, ]/g, '').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function wildcardToRegex(pattern) {
  const escaped = norm(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** Find the header row (first row that has a recognizable name column). */
function findHeaderRow(rows) {
  const nameKeys = [norm(P.COLUMNS.name), ...SYNONYMS.name];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((cell) => nameKeys.includes(norm(cell)))) return i;
  }
  return 0;
}

/** Map categories → column indexes, using config names, then groups, then synonyms. */
export function mapColumns(header) {
  const h = header.map(norm);
  const indexOf = (key) => {
    const configured = norm(P.COLUMNS[key]);
    let i = configured ? h.indexOf(configured) : -1;
    if (i === -1) i = h.findIndex((cell) => SYNONYMS[key].includes(cell));
    if (i === -1) i = h.findIndex((cell) => SYNONYMS[key].some((syn) => cell.startsWith(syn)));
    return i;
  };
  const map = { name: indexOf('name'), total: indexOf('total') };
  for (const cat of CATEGORIES) {
    const patterns = (P.COLUMN_GROUPS?.[cat] || []).filter(Boolean);
    if (patterns.length) {
      const regexes = patterns.map(wildcardToRegex);
      map[cat] = h.map((cell, i) => (regexes.some((r) => r.test(cell)) ? i : -1)).filter((i) => i >= 0);
    } else {
      const i = indexOf(cat);
      map[cat] = i >= 0 ? [i] : [];
    }
  }
  // Don't let "Points" be used as both a category and total.
  for (const cat of CATEGORIES) map[cat] = map[cat].filter((i) => i !== map.total && i !== map.name);
  return map;
}

const JUNK_NAMES = /^(total|totals|sum|average|avg|mean|count|max|min|name|—|-+)$/i;

/** Turn CSV text into sorted, ranked people. */
export function buildPeople(csvText) {
  const rows = parseCSV(csvText).filter((r) => r.some((c) => c !== ''));
  if (!rows.length) return { people: [], columns: null };
  const headerIdx = findHeaderRow(rows);
  const header = rows[headerIdx];
  const body = rows.slice(headerIdx + 1);
  const map = mapColumns(header);
  const isNumeric = (v) => v !== '' && /^-?[\d,.\s]+$/.test(v);
  const mostly = (i, test) => {
    const vals = body.map((r) => (r[i] || '').trim()).filter(Boolean);
    return vals.length > 0 && vals.filter(test).length / vals.length >= 0.8;
  };
  // Fallbacks for unrecognized headers: name = first mostly-text column,
  // total = last mostly-numeric column (only if no category/total was found).
  if (map.name < 0) map.name = header.findIndex((_, i) => mostly(i, (v) => !isNumeric(v)));
  if (map.name < 0) throw new Error('Couldn’t find a Name column in the sheet. Check POINTS.COLUMNS.name in config.js.');
  if (map.total < 0 && CATEGORIES.every((c) => !map[c].length)) {
    for (let i = header.length - 1; i >= 0; i--) {
      if (i !== map.name && mostly(i, isNumeric)) {
        map.total = i;
        break;
      }
    }
  }

  const people = [];
  const seen = new Set();
  for (const row of body) {
    const name = (row[map.name] || '').replace(/\s+/g, ' ').trim();
    if (!name || JUNK_NAMES.test(name)) continue;
    const person = { name };
    for (const cat of CATEGORIES) {
      person[cat] = map[cat].reduce((sum, i) => sum + num(row[i]), 0);
    }
    const sum = CATEGORIES.reduce((s, c) => s + person[c], 0);
    const hasTotal = map.total >= 0 && String(row[map.total] ?? '').trim() !== '';
    person.total = hasTotal ? num(row[map.total]) : sum;
    // Disambiguate duplicate names so each row stays selectable.
    let key = name.toLowerCase();
    let n = 2;
    while (seen.has(key)) key = `${name.toLowerCase()} (${n++})`;
    seen.add(key);
    person.id = key;
    people.push(person);
  }
  rank(people);
  return {
    people,
    columns: {
      hasMeetings: map.meetings.length > 0,
      hasProblems: map.problems.length > 0,
      hasContests: map.contests.length > 0,
    },
  };
}

/** Standard competition ranking (1, 2, 2, 4) by total, then name. */
export function rank(people) {
  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  people.forEach((p, i) => {
    p.rank = i > 0 && p.total === people[i - 1].total ? people[i - 1].rank : i + 1;
  });
  return people;
}

/** Points needed to reach the next-better rank (null if already #1). */
export function pointsToNextRank(person, people) {
  const above = people.filter((p) => p.total > person.total);
  if (!above.length) return null;
  const target = Math.min(...above.map((p) => p.total));
  const targetRank = people.find((p) => p.total === target).rank;
  return { points: +(target - person.total).toFixed(2), rank: targetRank };
}

/** Fetch + parse. Returns { people, columns, fetchedAt }. */
export async function loadPoints() {
  let res;
  try {
    res = await fetch(toCsvUrl(P.POINTS_SHEET_URL), { cache: 'no-store' });
  } catch {
    throw new Error('Couldn’t reach Google Sheets. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`The points sheet returned an error (${res.status}). Is it published to the web?`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('The points link returned a web page instead of CSV. Use File → Share → Publish to web → CSV.');
  }
  const { people, columns } = buildPeople(text);
  return { people, columns, fetchedAt: new Date() };
}
