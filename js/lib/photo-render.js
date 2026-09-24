/* Photo markup from data/gallery.json. Used by tools/build.mjs to fill every
 * <figure data-photo="id"> and the Home "Moments" gallery at build time. */
import { esc } from '../core/utils.js';

/**
 * @param {object} photo  entry from data/gallery.json
 * @param {object} opts
 * @param {string} opts.root   relative path to the site root ("", "../")
 * @param {string} [opts.sizes] the <img sizes> attribute
 * @param {boolean} [opts.eager] above-the-fold image: load immediately, high priority
 */
export function photoImg(photo, { root = '', sizes = '100vw', eager = false } = {}) {
  const srcset = (photo.srcset || []).map((s) => `${root}${s.src} ${s.w}w`).join(', ');
  const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<img src="${esc(root + photo.src)}" srcset="${esc(srcset)}" sizes="${esc(sizes)}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt)}" ${loading} decoding="async" style="object-position: ${esc(photo.focus || '50% 50%')}">`;
}

/* Bento layout for the Home gallery: big, wide, two small, two wide. */
const LAYOUT = ['is-wide is-tall', 'is-wide', '', '', 'is-wide', 'is-wide'];

export function renderGallery(photos, root = '') {
  return photos
    .filter((p) => p.inGallery)
    .slice(0, LAYOUT.length)
    .map(
      (p, i) => `<figure class="${LAYOUT[i]}" data-reveal="stagger">
        ${photoImg(p, { root, sizes: LAYOUT[i].includes('is-wide') ? '(min-width: 48em) 50vw, 100vw' : '(min-width: 48em) 25vw, 50vw' })}
        ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
      </figure>`,
    )
    .join('\n');
}
