/* Converts a rendered PNG sequence into something shippable.
 *
 *   node scripts/build-sequence.mjs "C:/path/to/frames" [outName]
 *
 * Writes public/sequence/<outName>/0000.webp … and prints the payload.
 *
 * This project is `output: 'export'` with `images.unoptimized`, so nothing
 * is processed at build time — whatever lands in public/ is what every
 * visitor downloads, frame for frame. A 66-frame 1920x1080 RGBA sequence is
 * 50 MB as PNG, which is not a hero, it is a download.
 *
 * WebP with alpha is the format that matters here: these frames are mostly
 * empty, and an alpha-aware codec charges almost nothing for the empty part
 * where PNG charges for every pixel.
 *
 * Frames are renamed to a dense zero-based index rather than keeping the
 * render's own numbering. The player addresses them by array position, and
 * a sequence that starts at DA001 while the code counts from 0 is one
 * off-by-one waiting to happen.
 */

import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [src, outName = 'hero'] = process.argv.slice(2);
if (!src) {
  console.log('usage: node scripts/build-sequence.mjs <folder> [outName]');
  process.exit(0);
}

/* Source resolution, and no step down.
 *
 * This was 1500 wide at q82, and the downscale was doing almost all of the
 * damage: measured against the source over the pixels that actually paint,
 * 1500/q82 lands at 27.1 dB where 1920/q86 lands at 37.6 dB for 0.3 MB
 * more. Ten decibels is not a tuning difference, it is the difference
 * between a soft image and a sharp one, and it was being paid for nothing.
 *
 * The canvas is sized to innerWidth x dpr, so on any ordinary 1920 monitor
 * a 1500px frame was being enlarged before it was ever seen. Matching the
 * render's own width is what makes that 1:1.
 *
 * q96 rather than q92 or lossless. The ladder flattens hard past q92
 * (40.6 dB at 6.3 MB, 41.8 at 7.6, then 21.5 MB for the last 
 * imperceptible fraction), so this is the last rung where the bytes still
 * buy something. alphaQuality is 100 because the edge is the whole subject
 * — a degraded matte gives the aircraft a halo, which no amount of RGB
 * quality hides.
 *
 * Override from the command line to try another point on that curve:
 *   node scripts/build-sequence.mjs <folder> hero 1920 92
 */
/* A KEYWORD, not a sentinel value. This was `QUALITY === 0`, passed as a
 * `0` on the command line — and `Number('0') || 96` is 96, because zero is
 * falsy. The build silently re-encoded instead of copying and reported
 * success. Anything whose "off" value is falsy cannot be defaulted with
 * `||`; a word cannot be mistaken for a number the shell forgot to pass. */
const PASSTHROUGH = process.argv.includes('raw');

/* Encoder search depth. Costs time and buys FILE SIZE, not quality — the
 * decoded image is identical either way. 4 is the sensible default while
 * you are iterating; 6 is worth it only for the build that ships, and even
 * then it is a few percent. */
const EFFORT = Number(process.argv[6]) || 4;

/* Frames are encoded CONCURRENTLY, in batches of this many.
 *
 * This loop used to await one frame at a time, which left almost all of the
 * machine idle: sharp hands off to libvips and releases the event loop, so
 * sequential awaits mean one core working and the rest waiting. At 4K that
 * is the difference between minutes and most of an hour — a 120-frame q96
 * build was still on frame 46 after twenty-five minutes.
 *
 * Batched rather than all at once because each in-flight frame holds a
 * decoded 4K bitmap, and 120 of those at 33MB apiece would trade the time
 * problem for a memory one. Eight bounds peak memory near a quarter of a
 * gigabyte and is below any core count worth having. */
const CONCURRENCY = 8;

/* An optional slice of the source, as `range=FIRST:END` with END exclusive.
 *
 * The render arrives as ONE export holding more than one sequence — the
 * opening move and the return that closes the page are a single continuous
 * camera path, and splitting them in Blender would mean matching the seam by
 * hand. Cutting here instead keeps them provably continuous: the last frame
 * of one slice and the first of the next are neighbours in the same render.
 *
 * Output is renumbered from 0 regardless, because the player addresses
 * frames by array position. `range=120:160` writes 0000..0039. */
const rangeArg = process.argv.find((a) => a.startsWith('range='));
const [RANGE_FROM, RANGE_TO] = rangeArg
  ? rangeArg.slice(6).split(':').map(Number)
  : [0, Infinity];
const WIDTH = Number(process.argv[4]) || 1920;
const QUALITY = Number(process.argv[5]) || 96;

/* QUALITY 0 means DO NOT TOUCH THE PIXELS. The frames are copied byte for
 * byte and only renamed, so what the browser decodes is exactly what came
 * out of the render — no resize, no encoder, not even a lossless one.
 *
 * This exists to settle one question and only one: when the sequence looks
 * soft, is that OUR compression or the render itself? Every other setting
 * confounds the two. Point the page at it with SEQUENCE_EXT = 'png' in
 * FieldHero.
 *
 *   node scripts/build-sequence.mjs <folder> hero raw
 *
 * It is not a shippable build. 120 uncompressed frames is tens of MB the
 * reader has to wait through, and at 4K it is also gigabytes of decoded
 * bitmap held in memory at once. Answer the question, then compress back
 * down and switch the flag to 'webp'. */

/* Built into a staging directory and swapped in at the end, NEVER written
 * into the live folder frame by frame.
 *
 * The live folder is served the whole time this runs, and a half-finished
 * sequence does not fail loudly: FieldSequence counts onerror toward its
 * loader on purpose, so the page comes up looking healthy and simply stops
 * advancing partway through the scrub. Encoding 120 frames at 4K takes long
 * enough to point the site at a folder that is only a third written — which
 * is exactly what happened. A rename is atomic, so the folder either has
 * every frame or is still the old build. */
const FINAL = path.join(process.cwd(), 'public', 'sequence', outName);
const OUT = `${FINAL}.staging`;
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

/* Sorted by NAME, which is only safe because the render pads its numbers.
   DA1, DA2 … DA10 would sort as 1, 10, 2 and the aircraft would judder. */
const frames = (await readdir(src))
  .filter((f) => /\.png$/i.test(f))
  .sort()
  .slice(RANGE_FROM, RANGE_TO === Infinity ? undefined : RANGE_TO);

if (!frames.length) {
  console.log(`no PNGs in ${src}`);
  process.exit(0);
}

let before = 0;
let after = 0;

let finished = 0;

/* The two size counters are read into locals BEFORE being added, never
   written as `total += await something()`.

   That form looks atomic and is not: it reads the running total, THEN
   suspends at the await, and while it is suspended the other seven frames
   in the batch update that same total. On resume it writes stale-base +
   its own value and every one of those updates is gone. It reported 7.2MB
   for a directory holding 14.8MB, and the input total came out 8x low —
   the concurrency factor, which is the tell. Harmless here because only
   the summary line was wrong, but the same shape around anything
   load-bearing is a silent data-loss bug. */
const one = async (i) => {
  const from = path.join(src, frames[i]);
  const to = path.join(OUT, `${String(i).padStart(4, '0')}.${PASSTHROUGH ? 'png' : 'webp'}`);
  const inSize = (await stat(from)).size;
  before += inSize;
  if (PASSTHROUGH) {
    await copyFile(from, to);
  } else {
    await sharp(from)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: EFFORT, alphaQuality: 100 })
      .toFile(to);
  }
  const outSize = (await stat(to)).size;
  after += outSize;
  finished += 1;
  if (finished % 10 === 0 || finished === frames.length) {
    process.stdout.write(`\r  ${finished}/${frames.length}`);
  }
};

for (let i = 0; i < frames.length; i += CONCURRENCY) {
  await Promise.all(frames.slice(i, i + CONCURRENCY).map((_, k) => one(i + k)));
}

/* The swap. Only now does anything the browser can reach change. */
await rm(FINAL, { recursive: true, force: true });
await rename(OUT, FINAL);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `\n${frames.length} frames  ${mb(before)} -> ${mb(after)} ` +
    `(-${(((before - after) / before) * 100).toFixed(0)}%)  ` +
    `avg ${(after / frames.length / 1024).toFixed(0)} KB/frame`
);
console.log(
  `out: public/sequence/${outName}/` +
    (rangeArg ? `  (source frames ${RANGE_FROM}..${RANGE_TO - 1}, renumbered from 0)` : '')
);
