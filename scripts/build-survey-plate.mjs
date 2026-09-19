/* Regrades public/images/survey-plain.webp — the survey beat's still plate —
 * to the colour of the LIVE terrain in the beats before it.
 *
 *   node scripts/build-survey-plate.mjs            writes the plate
 *   node scripts/build-survey-plate.mjs --mask     also writes the drone mask
 *
 * WHY. The plate is a Blender render and its ground is yellow-tan; the live
 * three.js terrain it dissolves in over is olive-brown. The plate only
 * greys AFTER it arrives (FlightPreview's cool-down filter ramps saturate
 * and brightness down), so the moment of handover is the raw plate against
 * the live ground — and that is where the two read as different places.
 *
 * WHAT. A colour transfer in CIELAB: the plate's terrain is shifted so each
 * channel's mean and spread match the live terrain's. Lab rather than RGB so
 * that lightness and colour move separately — matching RGB spreads directly
 * drags hue along with contrast.
 *
 * THE REFERENCE is scripts/source/live-terrain-ref.png: terrain-only strips
 * cut from a WebKit capture of the Fleet beat at 1600x900, with the copy,
 * the aircraft and the dashed links left out of every strip. Re-capture it
 * if the live terrain's albedo or grade changes, then re-run this.
 *
 * THE DRONE IS PROTECTED. The camo Mini in the bottom-left keeps the plate's
 * own colours: inside its region, pixels that are dark (carbon) or grey are
 * masked out of the transfer, feathered so the edge does not step.
 *
 * THE SOURCE IS THE ORIGINAL RENDER, scripts/source/survey-plain.orig.webp,
 * never the shipped plate — so running this twice does not regrade twice,
 * and build-thermal-panel.mjs keeps the tan-versus-olive hue it keys on.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
const sharp = createRequire(import.meta.url)('sharp');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'scripts', 'source', 'survey-plain.orig.webp');
const REF = path.join(ROOT, 'scripts', 'source', 'live-terrain-ref.png');
const OUT = path.join(ROOT, 'public', 'images', 'survey-plain.webp');
const WANT_MASK = process.argv.includes('--mask');

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* sRGB 0-255 <-> CIELAB (D65). */
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
function toLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function fromLab(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = fi(fx) * 0.95047, Y = fi(fy), Z = fi(fz) * 1.08883;
  const R = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const G = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const B = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  return [gam(clamp(R)), gam(clamp(G)), gam(clamp(B))];
}

function stats(samples) {
  const n = samples.length / 3, m = [0, 0, 0], s = [0, 0, 0];
  for (let i = 0; i < samples.length; i += 3) for (let k = 0; k < 3; k++) m[k] += samples[i + k];
  for (let k = 0; k < 3; k++) m[k] /= n;
  for (let i = 0; i < samples.length; i += 3) for (let k = 0; k < 3; k++) s[k] += (samples[i + k] - m[k]) ** 2;
  for (let k = 0; k < 3; k++) s[k] = Math.sqrt(s[k] / n);
  return { m, s };
}

/* Reference: every pixel of the terrain-only strips. */
const ref = await sharp(REF).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const refLab = new Float32Array(ref.info.width * ref.info.height * 3);
for (let i = 0; i < ref.info.width * ref.info.height; i++) {
  const lab = toLab(ref.data[i * 3], ref.data[i * 3 + 1], ref.data[i * 3 + 2]);
  refLab.set(lab, i * 3);
}
const R = stats(refLab);

/* Plate. */
const src = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = src.info.width, H = src.info.height;
const lab = new Float32Array(W * H * 3);
const protect = new Float32Array(W * H);

/* The drone's region: the plate's bottom-left, where FlightPreview's DRONE
   anchor sits (0.135, 0.80). Inside it, carbon is dark and the grey parts
   are desaturated; open ground is neither. */
const DRONE_BOX = { x0: 0, y0: 430, x1: 520, y1: H };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  const r = src.data[i * 3], g = src.data[i * 3 + 1], b = src.data[i * 3 + 2];
  lab.set(toLab(r, g, b), i * 3);
  if (x < DRONE_BOX.x1 && y >= DRONE_BOX.y0) {
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    const edge = smooth(DRONE_BOX.x1, DRONE_BOX.x1 - 40, x) * smooth(DRONE_BOX.y0, DRONE_BOX.y0 + 40, y);
    protect[i] = edge * Math.max(smooth(0.36, 0.26, L), smooth(0.14, 0.08, sat));
  }
}
/* Dilate and feather the protection so camo patches between carbon parts
   are covered and the boundary does not step. */
const pBuf = Buffer.from(protect.map((v) => Math.round(v * 255)));
const pBlur = await sharp(pBuf, { raw: { width: W, height: H, channels: 1 } })
  .blur(5).extractChannel(0).raw().toBuffer();
for (let i = 0; i < W * H; i++) protect[i] = clamp(Math.max(protect[i], (pBlur[i] / 255) * 2.2));

/* Target statistics: the plate's terrain only — everything the mask leaves. */
const terr = [];
for (let i = 0; i < W * H; i += 2) if (protect[i] < 0.05) terr.push(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]);
const T = stats(Float32Array.from(terr));

const out = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const moved = [0, 1, 2].map((k) => R.m[k] + ((lab[i * 3 + k] - T.m[k]) * R.s[k]) / (T.s[k] || 1));
  const rgb = fromLab(moved[0], moved[1], moved[2]);
  const p = protect[i];
  for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(rgb[k] * (1 - p) + src.data[i * 3 + k] * p);
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 90 }).toFile(OUT);
const fmt = (o) => `L ${o.m[0].toFixed(1)}±${o.s[0].toFixed(1)}  a ${o.m[1].toFixed(1)}±${o.s[1].toFixed(1)}  b ${o.m[2].toFixed(1)}±${o.s[2].toFixed(1)}`;
console.log('live terrain   ', fmt(R));
console.log('plate terrain  ', fmt(T));
console.log('wrote', OUT);

if (WANT_MASK) {
  const maskOut = process.argv[process.argv.indexOf('--mask') + 1] || path.join(ROOT, 'survey-plate-mask.png');
  await sharp(Buffer.from(protect.map((v) => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } }).png().toFile(maskOut);
  console.log('mask', maskOut);
}
