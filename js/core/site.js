/* Where the site lives, and how data files are loaded.
 *
 * Normal hosting: files are fetched relative to this script, so the site works
 * at a domain root or in a sub-folder (e.g. GitHub Pages project sites).
 * Weebly export: the build script sets window.__DHSCS_EXPORT__ and inlines the
 * data; assets resolve against CONFIG.SITE_URL. */
import CONFIG from '../../config.js';
import { isPlaceholder } from './utils.js';

export const IS_EXPORT = typeof window !== 'undefined' && Boolean(window.__DHSCS_EXPORT__);

export const ROOT = IS_EXPORT
  ? `${String(CONFIG.SITE_URL).replace(/\/+$/, '')}/`
  : new URL('../../', import.meta.url).href;

/** Absolute URL for a site-relative asset path like "assets/slides/x.webp". */
export function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  return new URL(path.replace(/^\/+/, ''), ROOT).href;
}

async function fetchJSON(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Load /data/<name>. In the Weebly export, prefer the live hosted copy and
 *  fall back to the copy baked in at build time. */
export async function loadData(name) {
  if (IS_EXPORT) {
    const inline = window.__DHSCS_DATA__?.[name];
    if (CONFIG.EMBED_FETCH_LIVE_DATA && !isPlaceholder(CONFIG.SITE_URL)) {
      try {
        return await fetchJSON(assetUrl(`data/${name}`), 4000);
      } catch {
        /* fall through to inline copy */
      }
    }
    if (inline) return inline;
    throw new Error(`Missing data: ${name}`);
  }
  return fetchJSON(assetUrl(`data/${name}`));
}

/** sessionStorage cache with a time-to-live. Fails silently (private mode). */
export const cache = {
  get(key, maxAgeMs) {
    try {
      const raw = sessionStorage.getItem(`dhscs:${key}`);
      if (!raw) return null;
      const { t, v } = JSON.parse(raw);
      return Date.now() - t < maxAgeMs ? v : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(`dhscs:${key}`, JSON.stringify({ t: Date.now(), v: value }));
    } catch {
      /* storage full or unavailable — caching is optional */
    }
  },
};
