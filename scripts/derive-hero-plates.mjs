/* Derives both hero plates from one source aerial so they share a frame and
   crop exactly — features must line up across the thermal lens edge, and
   aligned EO/IR photo pairs are effectively unobtainable as published assets.

   Thermal is luminance-driven: the source measures mean HSL saturation 0.056
   (effectively monochrome), so hue segmentation has no signal. Luminance spans
   p05 0.108 to p95 0.729, and in this scene brightness largely tracks sun
   exposure — sunlit limestone and scree absorb and re-radiate heat, shadowed
   rock and vegetation stay cool — so it is a defensible heat proxy.

   This produces a plausible simulation of an EO/IR payload, NOT sensor data.
   It must never be captioned as real thermal capture.

   Run: npm run plates
*/

import sharp from 'sharp';

const SRC = 'assets/hero/site-day-source.jpg';
const OUT = 'public/images';

/* Written under new names so the existing /  keeps its current plates while
   the preview route uses these. Rename to site-day/site-thermal when the new
   hero is adopted for real. */
const DAY_OUT = `${OUT}/terrain-day.webp`;
const HEAT_OUT = `${OUT}/terrain-thermal.webp`;

const DAY_W = 2400;
const HEAT_W = 1200; // thermal sensors resolve less detail than EO

/* Matches IRONBOW in src/components/HeroCluster/ThermalTerrain.tsx */
const IRONBOW = [
  [0.0, [6, 0, 20]],
  [0.18, [48, 8, 86]],
  [0.38, [132, 20, 96]],
  [0.55, [204, 48, 42]],
  [0.7, [240, 120, 24]],
  [0.85, [252, 214, 74]],
  [1.0, [255, 255, 255]],
];

function ironbow(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < IRONBOW.length - 1; i++) {
    const [a, ca] = IRONBOW[i];
    const [b, cb] = IRONBOW[i + 1];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a || 1);
      return [
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
      ];
    }
  }
  return [255, 255, 255];
}

/* Spread the mid-tones. The source clusters around p50 0.298, so mapping raw
   luminance onto the ramp leaves most of the frame in the cold purple end. */
const P05 = 0.108;
const P95 = 0.729;

/* Biased COOL. A linear (or boosted) mapping lands most of the frame in the
   ironbow's red/orange band, which reads as fire rather than as a sensor feed.
   Real EO/IR sits mostly in the cool purples, with orange and white reserved
   for genuinely warm objects.

   The gamma below pushes mid-tones down the ramp: mid-grey terrain lands in
   purple, and only the brightest sunlit rock, the road and the roof reach the
   hot end. */
/* The usable window of the ironbow ramp.

   FLOOR: IRONBOW starts at [6,0,20] — near black. A cool-mapped hillside over
   an already-dark day plate would be invisible, so cold ground starts at a
   legible deep violet instead.

   CEIL: stops short of the ramp's yellow/white top. Luminance-as-heat has no
   absolute reference — it normalises to this image's own range, and the
   brightest thing in frame is a large sheet of sunlit limestone, which
   therefore saturates. A yellow-white core ringed by orange reads as fire no
   matter what it represents. Capping at orange keeps it a temperature
   gradient. */
const FLOOR = 0.20;
const CEIL = 0.74;

function contrastCurve(v) {
  let x = (v - P05) / (P95 - P05);
  x = Math.max(0, Math.min(1, x));
  x = x * x * (3 - 2 * x); // smoothstep — spread the clustered mid-tones
  x = Math.pow(x, 1.45); // bias cool, so the hot end stays reserved

  return FLOOR + (CEIL - FLOOR) * x;
}

/* ---- day plate ---- */
await sharp(SRC)
  .resize({ width: DAY_W })
  .modulate({ brightness: 1.18 })
  .webp({ quality: 82 })
  .toFile(DAY_OUT);

console.log('wrote terrain-day.webp');

/* ---- thermal plate ---- */
const { data, info } = await sharp(SRC)
  .resize({ width: HEAT_W })
  .blur(1.6)
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(info.width * info.height * 3);

for (let i = 0, o = 0; i < data.length; i += info.channels, o += 3) {
  const r = data[i] / 255;
  const g = data[i + 1] / 255;
  const b = data[i + 2] / 255;

  // Rec. 709 luma — perceptual brightness, the best heat proxy available here.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const [tr, tg, tb] = ironbow(contrastCurve(luma));
  out[o] = tr;
  out[o + 1] = tg;
  out[o + 2] = tb;
}

await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
  .webp({ quality: 82 })
  .toFile(HEAT_OUT);

console.log('wrote terrain-thermal.webp');
