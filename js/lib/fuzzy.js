/* Forgiving name search: case-, accent- and whitespace-insensitive, any word
 * order ("mehta kavish"), prefix matches ("kav me"), and small typos. */

export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Damerau-Levenshtein (optimal string alignment) distance, capped for speed. */
export function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

const allowedTypos = (len) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

/** Score how well one query word matches one name word (lower is better, null = no match). */
function wordScore(q, w) {
  if (w === q) return 0;
  if (w.startsWith(q)) return 1;
  const typos = allowedTypos(q.length);
  if (!typos) return null;
  // Compare against the whole word and against a same-length prefix (typing in progress).
  const d = Math.min(editDistance(q, w, typos), editDistance(q, w.slice(0, q.length), typos));
  return d <= typos ? 2 + d : null;
}

/**
 * @param {string} query
 * @param {Array<{ name: string }>} people
 * @param {number} limit
 * @returns matches sorted best-first
 */
export function searchPeople(query, people, limit = 8) {
  const qWords = normalize(query).split(' ').filter(Boolean);
  if (!qWords.length) return [];
  const results = [];
  for (const person of people) {
    const nameWords = person._norm || (person._norm = normalize(person.name).split(' '));
    const joined = nameWords.join(' ');
    let total = 0;
    const used = new Set();
    let ok = true;
    for (const q of qWords) {
      let best = null;
      let bestIdx = -1;
      nameWords.forEach((w, i) => {
        if (used.has(i)) return;
        const s = wordScore(q, w);
        if (s !== null && (best === null || s < best)) {
          best = s;
          bestIdx = i;
        }
      });
      if (best === null) {
        ok = false;
        break;
      }
      used.add(bestIdx);
      total += best;
    }
    // Also allow "kavishmehta" / missing spaces.
    if (!ok) {
      const q = qWords.join('');
      const flat = joined.replace(/ /g, '');
      if (flat.startsWith(q)) {
        ok = true;
        total = 1;
      } else if (q.length >= 5 && editDistance(q, flat.slice(0, q.length), 2) <= 1) {
        ok = true;
        total = 4;
      }
    }
    if (ok) results.push({ person, score: total + (joined.startsWith(normalize(query)) ? -1 : 0) });
  }
  results.sort((a, b) => a.score - b.score || a.person.name.localeCompare(b.person.name));
  return results.slice(0, limit).map((r) => r.person);
}

/** Close-but-not-matching names for the "no results" state. */
export function suggestPeople(query, people, limit = 3) {
  const q = normalize(query).replace(/ /g, '');
  if (!q) return [];
  return people
    .map((p) => {
      const words = normalize(p.name).split(' ');
      const d = Math.min(...words.map((w) => editDistance(q, w, 4)), editDistance(q, words.join(''), 4));
      return { p, d };
    })
    .filter((x) => x.d <= 4)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}
