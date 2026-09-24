#!/usr/bin/env node
/* Photo optimizer: club photos (page headers + Home "Moments" gallery) and slide covers.
 *
 *   npm run images
 *
 * • Photos: put JPG/PNG/WebP/HEIC photos in assets/images/originals/. Each is
 *   resized to 480/960/1600px WebP (never upscaled) in assets/images/photos/,
 *   and data/gallery.json is updated. Hand-edited fields (alt, caption,
 *   inGallery, focus) are kept. Then run `npm run build` to place them.
 * • Slide covers: put images in assets/slides/originals/; each becomes a
 *   1280×720 WebP in assets/slides/ (center-cropped to 16:9). Reference it in
 *   data/slides.json as "coverImage": "assets/slides/<name>.webp". */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|heic|heif|tiff?)$/i;
const slug = (f) => basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function listImages(dir) {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => IMAGE_EXT.test(f)).sort();
}

/* ---------- Gallery ---------- */
const galSrc = join(ROOT, 'assets/images/originals');
const galOut = join(ROOT, 'assets/images/photos');
const galleryFile = join(ROOT, 'data/gallery.json');
const gallery = JSON.parse(await readFile(galleryFile, 'utf8'));
const existing = new Map((gallery.photos || []).map((p) => [p.id, p]));
const photos = [];

for (const file of await listImages(galSrc)) {
  await mkdir(galOut, { recursive: true });
  const id = slug(file);
  const img = sharp(join(galSrc, file)).rotate(); // respect EXIF orientation
  const meta = await img.metadata();
  const w0 = meta.autoOrient?.width || meta.width;
  const h0 = meta.autoOrient?.height || meta.height;
  const srcset = [];
  // 480/960/1600px, never upscaled; a smaller original also gets its own full-size version.
  const widths = [480, 960, 1600].filter((w) => w < w0);
  if (!widths.includes(w0) && w0 <= 1600) widths.push(w0);
  for (const width of widths) {
    const out = `assets/images/photos/${id}-${width}.webp`;
    await sharp(join(galSrc, file)).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(ROOT, out));
    srcset.push({ src: out, w: width });
  }
  const largest = srcset[srcset.length - 1];
  const prev = existing.get(id) || {};
  photos.push({
    id,
    src: srcset[Math.min(1, srcset.length - 1)].src,
    srcset,
    width: largest.w,
    height: Math.round((largest.w * h0) / w0),
    alt: prev.alt || `TODO: describe this photo (${file})`,
    caption: prev.caption || '',
    inGallery: prev.inGallery ?? true, // show in the Home "Moments" gallery
    focus: prev.focus || '50% 50%', // CSS object-position used when the photo is cropped
  });
  console.log(`  gallery: ${file} → ${srcset.map((s) => s.w).join('/')}px`);
}
if (photos.length) {
  gallery.photos = photos;
  await writeFile(galleryFile, `${JSON.stringify(gallery, null, 2)}\n`);
}

/* ---------- Slide covers ---------- */
const covSrc = join(ROOT, 'assets/slides/originals');
for (const file of await listImages(covSrc)) {
  const out = `assets/slides/${slug(file)}.webp`;
  await sharp(join(covSrc, file)).rotate().resize(1280, 720, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(join(ROOT, out));
  console.log(`  cover: ${file} → ${out}`);
}

console.log(photos.length ? `✓ ${photos.length} gallery photo(s). Now edit the alt text in data/gallery.json.` : '✓ Done (no gallery photos found in assets/images/originals/).');
