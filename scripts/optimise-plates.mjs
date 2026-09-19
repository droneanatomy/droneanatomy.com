/* Converts the hero-plate PNGs to WebP.
 *
 * This project is `output: 'export'` with `images.unoptimized`, so next/image
 * does no work at build time — whatever sits in public/images is what every
 * visitor downloads, byte for byte. A full-bleed 2752px plate is ~8.5 MB as
 * PNG and well under a megabyte as WebP, for a photograph nobody will ever
 * inspect at 1:1.
 *
 * Run after dropping a new plate in:
 *   node scripts/optimise-plates.mjs
 *
 * PNG sources are left in place (untracked-friendly); point PLATE_SRC in
 * FieldHero at the .webp.
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'images');
const QUALITY = 80;

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const files = (await readdir(DIR)).filter(
  (f) => f.startsWith('hero-plate-') && f.endsWith('.png')
);

if (!files.length) {
  console.log('no hero-plate-*.png found in public/images');
  process.exit(0);
}

for (const f of files) {
  const src = path.join(DIR, f);
  const out = src.replace(/\.png$/, '.webp');
  const before = (await stat(src)).size;

  await sharp(src).webp({ quality: QUALITY, effort: 6 }).toFile(out);

  const after = (await stat(out)).size;
  const saved = (((before - after) / before) * 100).toFixed(1);
  console.log(
    `${f.padEnd(30)} ${kb(before).padStart(9)} -> ${kb(after).padStart(8)}  (-${saved}%)`
  );
}
