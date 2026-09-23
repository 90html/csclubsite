/* Points data: fetch the published Google Sheet (CSV), map columns (with
 * auto-detection + column groups), compute totals and ranks.
 * Nothing here logs or sends names anywhere. */
import CONFIG from '../../config.js';
import { isPlaceholder } from '../core/utils.js';
import { parseCSV } from './csv.js';

const P = CONFIG.POINTS;
export const IS_DEMO = isPlaceholder(P.POINTS_SHEET_URL);
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
    return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${gid[1]}` : ''}`;
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
  const map = mapColumns(header);
  if (map.name < 0) throw new Error('Couldn’t find a Name column in the sheet. Check POINTS.COLUMNS.name in config.js.');

  const pv = P.POINT_VALUES || {};
  const multiplier = {
    meetings: P.VALUES_ARE_COUNTS && !isPlaceholder(pv.meeting) ? Number(pv.meeting) || 1 : 1,
    problems: P.VALUES_ARE_COUNTS && !isPlaceholder(pv.problem) ? Number(pv.problem) || 1 : 1,
    contests: P.VALUES_ARE_COUNTS && !isPlaceholder(pv.contest) ? Number(pv.contest) || 1 : 1,
  };

  const people = [];
  const seen = new Set();
  for (const row of rows.slice(headerIdx + 1)) {
    const name = (row[map.name] || '').replace(/\s+/g, ' ').trim();
    if (!name || JUNK_NAMES.test(name)) continue;
    const person = { name };
    for (const cat of CATEGORIES) {
      person[cat] = map[cat].reduce((sum, i) => sum + num(row[i]), 0) * multiplier[cat];
    }
    const sum = CATEGORIES.reduce((s, c) => s + person[c], 0);
    const hasTotal = map.total >= 0 && String(row[map.total] ?? '').trim() !== '';
    person.total = hasTotal && !P.VALUES_ARE_COUNTS ? num(row[map.total]) : sum;
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

/* ---------------- DEMO data (only while the sheet URL is a placeholder) ---------------- */
const DEMO_NAMES = [
  'Ava Martinez', 'Liam Chen', 'Sofia Patel', 'Noah Johnson', 'Mia Nguyen', 'Ethan Brooks', 'Isabella García',
  'Lucas Kim', 'Amelia Singh', 'Mason Rivera', 'Harper Lee', 'Elijah Thompson', 'Evelyn Okafor', 'James Park',
  'Abigail Rossi', 'Benjamin Cruz', 'Emily Zhang', 'Henry Adeyemi', 'Ella Kowalski', 'Alexander Reyes',
  'Chloé Dubois', 'Daniel Murphy', 'Zoë Anderson', 'Matthew Ito', 'Aria Hassan', 'Samuel Novak', 'Layla Ahmed',
  'Jack Wilson', 'Nora Fischer', 'Owen Sato', 'Riley Bennett', 'Leo Moreau', 'Hazel Kapoor', 'Julian Santos',
  'Violet Morgan', 'Levi Ortiz', 'Aurora Silva', 'Isaac Wright', 'Stella Ivanova', 'Gabriel Costa', 'Lucy Tanaka',
  'Caleb Hughes', 'Maya Desai', 'Ryan O’Connor', 'Naomi Ferreira', 'Adrian Petrov', 'Elena Vasquez', 'Miles Carter',
];

/** Deterministic pseudo-random numbers so demo data is stable between reloads. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function demoCSV() {
  const rnd = seeded(42);
  const lines = ['Name,Meetings,Problems,Contests,Total'];
  for (const name of DEMO_NAMES) {
    const meetings = Math.round(rnd() * 14) + 1;
    const problems = Math.round(rnd() ** 1.6 * 40);
    const contests = Math.round(rnd() ** 2 * 5) * 5;
    lines.push(`"${name}",${meetings},${problems},${contests},${meetings + problems + contests}`);
  }
  lines.push(',,,,', 'Total,,,,'); // Trailing junk rows, like real sheets often have.
  return lines.join('\n');
}

/** Fetch + parse. Returns { people, columns, demo, fetchedAt }. */
export async function loadPoints() {
  let text;
  if (IS_DEMO) {
    text = demoCSV();
  } else {
    const url = toCsvUrl(P.POINTS_SHEET_URL);
    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch {
      throw new Error('Couldn’t reach Google Sheets. Check your connection and try again.');
    }
    if (!res.ok) throw new Error(`The points sheet returned an error (${res.status}). Is it published to the web?`);
    text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) {
      throw new Error('The points link returned a web page instead of CSV. Use File → Share → Publish to web → CSV.');
    }
  }
  const { people, columns } = buildPeople(text);
  return { people, columns, demo: IS_DEMO, fetchedAt: new Date() };
}
