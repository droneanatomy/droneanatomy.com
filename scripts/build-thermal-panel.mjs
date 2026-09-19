/* Builds public/images/thermal-panel.webp — the "Thermal sensor" frame in
 * the flight section's survey beat — FROM THE SURVEY PLATE ITSELF.
 *
 *   node scripts/build-thermal-panel.mjs
 *
 * WHY IT IS DERIVED, NOT RENDERED. The panel used to be stock art of a
 * different compound: pitched-roof barracks in a layout that matched
 * nothing in survey-plain.webp. The plate's compound — two watchtowers,
 * four container buildings, vehicles — was modelled and rendered in
 * Blender, and only the flat render ships with this project, so there is
 * no 3D scene here to re-render with a thermal material. This takes the
 * compound out of that render instead, which keeps the buildings, their
 * layout and the camera's angle on them exactly as the reader sees them a
 * moment earlier, and restyles it white-hot.
 *
 * If the Blender scene becomes available, a true thermal render from the
 * sensor camera would be better than this, and should replace it.
 *
 * HOW: every hot object is boxed by hand (OBJECTS); inside a box the
 * object is whatever is greener than the tan ground around it — which
 * separates a building from its own cast shadow where brightness cannot —
 * and its heat follows the render's own shading so it keeps its form.
 * The frame is then tone-matched, percentile for percentile, to the panel
 * it replaced (median 76, p90 133, p99 203).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
const sharp = createRequire(import.meta.url)('sharp');

/* THE ORIGINAL RENDER, not the shipped plate. public/images/survey-plain.webp
   is now regraded to the live terrain (scripts/build-survey-plate.mjs), and
   this build separates buildings from ground by the ORIGINAL tan-versus-
   olive hue — run against the regraded plate, whose ground is olive too,
   it would stop finding them. */
const SRC = path.join(process.cwd(), 'scripts', 'source', 'survey-plain.orig.webp');
const OUT = process.argv[2] || path.join(process.cwd(), 'public', 'images', 'thermal-panel.webp');
const W = 720, H = 424;

/* The compound's frame in the 1600x900 plate, at the panel's own 1.70
   aspect, centred on the compound rather than on the ridge below it. */
const CROP = { left: 920, top: 10, width: 380, height: 224 };

/* EVERY HOT OBJECT, boxed by hand off the plate (plate pixels, padded).
   Detection over the whole frame could not tell grey rock from grey
   buildings; inside a box it only has to tell the object from the ground
   immediately around it, and nothing outside a box can ever light up. */
const OBJECTS = [
  { name: 'tower L',     box: [1036, 66, 1060, 100], heat: 0.9 },
  { name: 'building A',  box: [1078, 84, 1118, 109], heat: 1.0 },
  { name: 'building B',  box: [1122, 96, 1167, 123], heat: 1.0 },
  { name: 'building C',  box: [1060, 116, 1112, 148], heat: 1.0 },
  { name: 'building D',  box: [1024, 141, 1074, 171], heat: 1.0 },
  { name: 'tower R',     box: [1229, 95, 1260, 133], heat: 0.9 },
  { name: 'vehicle L',   box: [955, 98, 1002, 121], heat: 0.95, small: true },
  { name: 'gear L',      box: [1032, 97, 1060, 113], heat: 0.8, small: true },
  { name: 'scatter',     box: [1112, 118, 1265, 162], heat: 0.85, small: true },
];

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/* mulberry32 — a real 32-bit PRNG. The first pass used an LCG in float
   arithmetic, which overflowed double precision and repeated per row as
   visible horizontal stripes. */
let seedState = 0x9e3779b9;
const rand = () => { seedState |= 0; seedState = (seedState + 0x6d2b79f5) | 0; let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const base = sharp(SRC).extract(CROP).resize(W, H, { kernel: 'lanczos3' });
const rgb = await base.clone().removeAlpha().raw().toBuffer();

const L = new Float32Array(W * H);
const S = new Float32Array(W * H);
/* green over red. The ground is tan (red clearly above green); the
   buildings, towers and vehicles are olive and grey (green close to red);
   and a shadow on tan ground is still tan — darker, same ratio. So this,
   not brightness, is what separates an object from its own shadow. */
const GR = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = rgb[i * 3] / 255, g = rgb[i * 3 + 1] / 255, b = rgb[i * 3 + 2] / 255;
  L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  GR[i] = r > 0.02 ? g / r : 1;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  S[i] = mx > 0 ? (mx - mn) / mx : 0;
}

const sx = W / CROP.width, sy = H / CROP.height;
const seed = Buffer.alloc(W * H);
const groundRef = new Float32Array(W * H);
const report = [];
for (const o of OBJECTS) {
  const x0 = Math.max(0, Math.round((o.box[0] - CROP.left) * sx)), x1 = Math.min(W - 1, Math.round((o.box[2] - CROP.left) * sx));
  const y0 = Math.max(0, Math.round((o.box[1] - CROP.top) * sy)), y1 = Math.min(H - 1, Math.round((o.box[3] - CROP.top) * sy));
  /* The ground reference is the BORDER of the box — a ring the object
     does not reach — so the test is "unlike the ground right here". */
  const ringL = [], ringGR = [];
  for (let x = x0; x <= x1; x++) for (const y of [y0, y0 + 1, y1 - 1, y1]) { ringL.push(L[y * W + x]); ringGR.push(GR[y * W + x]); }
  for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) { ringL.push(L[y * W + x]); ringGR.push(GR[y * W + x]); }
  ringL.sort((a, b) => a - b); ringGR.sort((a, b) => a - b);
  const gL = ringL[ringL.length >> 1], gGR = ringGR[ringGR.length >> 1];
  let lit = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    /* Object: greener than the tan around it. A very dark pixel whose hue
       is too dim to read counts only weakly, which lets a shaded wall
       join its roof without letting a whole cast shadow in. */
    const hue = (GR[i] - gGR) / 0.09;
    /* SMALL OBJECTS ARE DARK, and that is the whole difference. Vehicles
       and crates render as near-black grey with no olive to key on, so the
       hue test misses them — and the shadow rule then cooled them, turning
       the hottest things in a real thermal frame black. In a small-object
       box a clearly dark blob is not a cast shadow worth protecting; it is
       the object. Buildings keep the cautious weight, because there the
       dark pixels beside a roof ARE mostly shadow. */
    const dark = smooth(0.55, 0.9, (gL - L[i]) / 0.3) * (o.small ? 1.0 : 0.45);
    const v = smooth(0.35, 1.0, Math.max(hue, dark)) * o.heat;
    if (v > 0.05) lit++;
    seed[i] = Math.max(seed[i], Math.round(255 * v));
    /* Remember the ground brightness here, for the shadow test below. */
    groundRef[i] = gL;
  }
  report.push(`${o.name}: ${lit}px hot`);
}

/* extractChannel(0): sharp promotes a blurred single-channel raw buffer to
   THREE channels, and indexing that as one channel smeared every hot pixel
   to the wrong place — the objects stayed dark and stripes appeared in the
   corners. Measured: 1 channel in, 3 out, length 915840 against 305280. */
const blur1 = async (sigma) => {
  const { data, info } = await sharp(seed, { raw: { width: W, height: H, channels: 1 } })
    .blur(sigma).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || data.length !== W * H) throw new Error(`mask came back ${info.channels}ch/${data.length}`);
  return data;
};
const fill = await blur1(0.8);
const halo = await blur1(6);

const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  /* Ground: dark, carrying the render's own relief. Saturated sunlit sand
     reads a little warmer than grey rock, as ground does in the day. */
  /* Tone matched to the panel this replaces, by measurement (luma of the
     frame inside a 20px border): theirs runs median 76 / p90 133 / p99 203.
     The first pass squeezed the ground into 44-63 and clipped the hot
     objects at 251, which is why it read flat and harsh beside it. */
  let v = 0.10 + 0.52 * clamp((L[i] - 0.12) / 0.62) + 0.04 * clamp(S[i] / 0.5);
  const hot = smooth(0.1, 0.7, clamp((fill[i] / 255) * 1.6));
  const glow = clamp((halo[i] / 255) * 1.3);
  /* FORM, not a splat: inside an object the brightness follows the
     render's own shading, so a sunlit roof reads hotter than the wall
     turned away from the sun and the object keeps its shape. */
  const form = 0.46 + 0.36 * clamp((L[i] - 0.06) / 0.46);
  /* Cast shadow — darker than the local ground but not an object — is
     the coolest thing in frame, as shaded ground is. */
  if (groundRef[i] > 0 && hot < 0.1 && L[i] < groundRef[i] - 0.12) v *= 0.72;
  v = v + (form - v) * hot + 0.14 * glow;
  const nx = x / W - 0.5, ny = y / H - 0.5;
  v *= 1 - 0.5 * Math.pow(Math.sqrt(nx * nx * 1.2 + ny * ny * 1.6), 2.2);
  /* Small, because the tone match below steepens the mid-greys about 3.8x
     (99->76 to 114->133) and at 0.04 that turned the grain into grit. */
  v += (rand() - 0.5) * 0.012;
  v = clamp(v);
  const warm = smooth(0.84, 1.0, v) * 0.05;
  out[i * 3] = Math.round(255 * clamp(v + warm));
  out[i * 3 + 1] = Math.round(255 * v);
  out[i * 3 + 2] = Math.round(255 * clamp(v - warm * 0.6));
}

/* PERCENTILE TONE MATCH against the panel this replaces. The plate's sand
   has a narrow luminance range, so no linear remap could open the ground
   up to theirs without clipping something; a piecewise curve through four
   anchors — each of OUR percentiles onto THEIRS — can. Measured inside a
   20px border so the vignette edge does not bias it. */
const TARGET = [[0.10, 44], [0.50, 76], [0.90, 133], [0.99, 203]];
const lum = [];
for (let y = 20; y < H - 20; y++) for (let x = 20; x < W - 20; x++) lum.push(out[(y * W + x) * 3 + 1]);
lum.sort((a, b) => a - b);
const anchors = [[0, 0], ...TARGET.map(([q, t]) => [lum[Math.floor(lum.length * q)], t]), [255, 255]];
const curve = (v) => {
  for (let k = 1; k < anchors.length; k++) {
    const [a0, b0] = anchors[k - 1], [a1, b1] = anchors[k];
    if (v <= a1) return a1 === a0 ? b1 : b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
  }
  return 255;
};
const lut = Uint8ClampedArray.from({ length: 256 }, (_, v) => Math.round(curve(v)));
for (let i = 0; i < out.length; i++) out[i] = lut[out[i]];
console.log('tone anchors (ours -> theirs):', anchors.slice(1, -1).map(([a, b]) => `${a}->${b}`).join('  '));

await sharp(out, { raw: { width: W, height: H, channels: 3 } }).blur(0.55).webp({ quality: 90 }).toFile(OUT);
console.log('wrote', OUT); console.log(report.join('\n'));
