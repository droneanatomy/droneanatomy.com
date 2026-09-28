/* Turns the captured three.js frames into the plates the mobile sections show.
 *
 * WHY THESE EXIST. On a phone the homepage no longer mounts three at all —
 * see MobileScenes. Skipping it saves the 560 KB three chunk, 3.5 MB of
 * Draco GLBs and 1.5 MB of terrain, and it is the difference between the
 * page keeping up on a low-to-mid device and not. What replaces it is these:
 * one still per beat, with the beat's own copy under it.
 *
 * WHERE THEY CAME FROM. Captured from the running scene on desktop, not
 * rendered elsewhere and colour-matched — so they are the real thing, lit
 * and fogged exactly as the live scene lights and fogs it. Method: a
 * temporary `preserveDrawingBuffer: true` on the renderer plus a forced
 * pixel ratio of 2, then the page driven to each beat's settled scroll
 * position and the canvas read with toDataURL. Sources are 2134x1334, in
 * scripts/source/scenes/.
 *
 * Re-capture only if the scenes themselves change. The crops below are the
 * part worth keeping: each one was picked against the beat's own
 * composition, and a centre crop would lose the subject in three of them.
 *
 *   node scripts/build-scene-plates.mjs
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.join(process.cwd(), 'scripts', 'source', 'scenes');
const OUT = path.join(process.cwd(), 'public', 'images', 'scenes');

/* 4:3, because the mobile panel gives the picture a near-square box — the
   copy takes the rest of the panel. Wider than the box is fine (object-cover
   trims the sides); taller is not, so the crops never go below 4:3. */
const W = 1200;
const H = 900;
const QUALITY = 78;

/* Crop windows as fractions of the 2134x1334 source: [left, top, w, h].
   Chosen per beat rather than centred, for the reason each line gives. */
const PLATES = [
  /* THE HERO'S RESTING STATE, which is what a phone sees anyway. The ink
     reveal wipes the photograph in under the pointer, and a phone has no
     pointer to wipe with — so at rest the sheet is paper and its faint
     contour lines, and that is exactly what this is. Flat, so it costs
     almost nothing to ship. */
  { id: 'inkhero', crop: [0.00, 0.00, 1.00, 1.00] },

  /* The turntable beat. The airframe already fills the middle third and
     sits a little above centre; dropping the top 8% puts it on the
     thirds line without losing wingtip. */
  { id: 'approach', crop: [0.06, 0.08, 0.88, 0.84] },

  /* A vista, and the aircraft is deliberately tiny in it. Left full width
     it becomes a speck on a phone, so this takes the middle 62% — still
     reads as distance, but the craft is findable. */
  { id: 'transit', crop: [0.19, 0.12, 0.62, 0.72] },

  /* THREE AIRCRAFT AND THE LINK MESH, which is the entire point of the
     beat and is invisible at phone size uncropped: the formation spans
     the frame with two of the three near the edges. This window is the
     one that holds all three and the dashed links between them. */
  { id: 'swarm', crop: [0.20, 0.15, 0.60, 0.62] },

  /* The Mini sits bottom LEFT here — the plate is built around that, and
     it is why the survey card ranges right. Crop favours the lower left
     so the aircraft survives; taking the centre would cut it out. */
  { id: 'survey', crop: [0.00, 0.14, 0.70, 0.82] },

  /* The massif in profile, before the section turns it into contours.
     It sits in the middle band of an otherwise black frame, so this is
     mostly about throwing away empty sky and foreground. */
  { id: 'topo-massif', crop: [0.06, 0.26, 0.88, 0.68] },

  /* And the contour read of the same mountain — "what's inside". The
     figure is centred and round, so a square-ish window suits it. */
  { id: 'topo-contour', crop: [0.22, 0.02, 0.56, 0.96] },
];

await mkdir(OUT, { recursive: true });

let total = 0;
for (const { id, crop } of PLATES) {
  const src = path.join(SRC, `${id}.jpg`);
  const meta = await sharp(src).metadata();
  const [l, t, w, h] = crop;
  const info = await sharp(src)
    .extract({
      left: Math.round(meta.width * l),
      top: Math.round(meta.height * t),
      width: Math.round(meta.width * w),
      height: Math.round(meta.height * h),
    })
    .resize(W, H, { fit: 'cover' })
    .webp({ quality: QUALITY })
    .toFile(path.join(OUT, `${id}.webp`));
  total += info.size;
  console.log(`  ${id.padEnd(14)} ${W}x${H}  ${(info.size / 1024).toFixed(0)} KB`);
}
console.log(`  ${''.padEnd(14)} ${'-'.repeat(16)}`);
console.log(`  ${'total'.padEnd(14)} ${(total / 1024).toFixed(0)} KB across ${PLATES.length} plates`);
