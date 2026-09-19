/* Keys the magenta backdrop out of the generated yard props.
 *
 *   node scripts/key-chroma.mjs ~/Downloads/bale.png ~/Downloads/drum.png ...
 *
 * Writes a straight-alpha PNG per input into public/images/yard/.
 *
 * Why a script and not an editor: straw, frayed rope and rusted metal all
 * have thousands of sub-pixel edges, and a threshold cut either eats them or
 * leaves a pink halo. What is needed is a soft key plus a de-spill, applied
 * identically to every prop so twelve objects composite as one set. That is
 * three lines of arithmetic and completely unreasonable to do by hand twelve
 * times.
 *
 * Magenta is the key colour because nothing in a farmyard is magenta. The
 * test for it is min(R,B) - G: magenta pushes red and blue up and green
 * down, so that difference is large on backdrop and negative on straw, wood,
 * rust and grass alike. The same trick as a green screen's G - max(R,B),
 * turned around.
 */

import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'yard');

/* The alpha ramp, in units of that min(R,B)-G difference.
 *
 * Below LOW is subject and stays fully opaque; above HIGH is backdrop and
 * goes fully clear; between the two is the fringe, which gets partial alpha
 * so a straw wisp covering a third of a pixel keeps a third of its opacity.
 *
 * A single threshold — LOW === HIGH — is what produces the hard, crunchy
 * edge that reads as a cut-out. The gap between them IS the soft edge. */
const LOW = 40;
const HIGH = 170;

/* How far in from the matte edge to correct the magenta cast, in pixels.
 *
 * The contamination does NOT stop where alpha stops. Bounce light off a
 * magenta backdrop lands on the object itself, so the first pixel or two of
 * genuinely opaque subject are purple too. De-spilling only the soft pixels
 * leaves a one-pixel pink line tracing the whole silhouette, which is
 * invisible at 100% and unmistakable the moment the layer is scaled up.
 *
 * Correcting a BAND rather than the whole image is what keeps this safe for
 * the tarpaulin and the galvanised trough, which are legitimately blue: a
 * blanket de-spill would have to assume blue is never real, and their
 * interiors are nowhere near an edge. Generous, because the ratio test below
 * leaves clean pixels alone anyway — the band only bounds the blast radius. */
const EDGE_BAND = 6;

/* What blue-to-green ratio the subject is expected to have, and the one knob
 * worth turning per object. Override with --blue=N.
 *
 *   0.55  straw, wood, rust, rope, dirt — anything warm (default)
 *   0.95  galvanised metal, concrete, weathered grey timber
 *   skip  the blue tarpaulin: pass --blue=2 to disable correction entirely
 *
 * It exists because removing magenta is underdetermined. Magenta adds an
 * EQUAL amount to red and blue, so the correction must subtract an equal
 * amount from both — but nothing in the pixel says how much was added. The
 * blue channel is the usable tell: a warm subject's blue sits well below its
 * green, so blue in excess of that is the contamination, and red gets the
 * same subtraction.
 *
 * Getting this wrong in the obvious way is what produced a pink rim on the
 * first attempt: neutralising only until min(R,B) met green removes the blue
 * half of the magenta and leaves the red half, turning a brown edge pixel
 * salmon. Salmon then reads as clean to a magenta test, which is why the
 * halo survived a check that reported zero residual spill. */
const BLUE_RATIO = Number(
  (process.argv.find((a) => a.startsWith('--blue=')) || '=0.55').split('=')[1]
);

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

const slug = (f) =>
  path
    .basename(f, path.extname(f))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function key(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const n = width * height;
  let clear = 0;
  let fringe = 0;

  /* Pass 1 — the key. Alpha only; colour is left alone for now, because
     the correction below needs to know where the edges ended up. */
  const soft = new Uint8Array(n); // 1 where this pixel is not fully opaque
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    // Positive on magenta, negative on everything a farmyard is made of.
    const spill = Math.min(data[i], data[i + 2]) - data[i + 1];
    if (spill <= LOW) continue;

    const a = clamp(Math.round(255 * (1 - (spill - LOW) / (HIGH - LOW))));
    data[i + 3] = a;
    soft[p] = 1;
    if (a === 0) clear++;
    else fringe++;
  }

  /* Pass 2 — grow that into a band reaching EDGE_BAND pixels into the
     opaque interior. Separable: a horizontal dilation then a vertical one
     gives the same result as a square kernel for far fewer reads. */
  const band = Uint8Array.from(soft);
  const grow = (stride, span) => {
    const src = Uint8Array.from(band);
    for (let p = 0; p < n; p++) {
      if (src[p]) continue;
      const along = stride === 1 ? p % width : (p / width) | 0;
      for (let d = -EDGE_BAND; d <= EDGE_BAND; d++) {
        const at = along + d;
        if (at < 0 || at >= span) continue;
        if (src[p + d * stride]) {
          band[p] = 1;
          break;
        }
      }
    }
  };
  grow(1, width);
  grow(width, height);

  /* Pass 3 — take the contamination back out across the band.
     Blue above BLUE_RATIO x green is magenta that does not belong to the
     subject; subtract it from blue AND from red, equally, because that is
     how it arrived. Pixels already below the ratio are left untouched, so
     clean straw passes through unchanged. */
  let corrected = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (!band[p] || data[i + 3] === 0) continue;
    const over = data[i + 2] - data[i + 1] * BLUE_RATIO;
    if (over <= 0) continue;
    data[i] = clamp(data[i] - over);
    data[i + 2] = clamp(data[i + 2] - over);
    corrected++;
  }

  const out = path.join(OUT_DIR, `${slug(src)}.png`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(out);

  return {
    out,
    w: width,
    h: height,
    clearPct: ((clear / n) * 100).toFixed(1),
    fringePx: fringe,
    corrected,
  };
}

const inputs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!inputs.length) {
  console.log('usage: node scripts/key-chroma.mjs <image...>');
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });

for (const src of inputs) {
  try {
    const r = await key(src);
    console.log(
      `${path.basename(src).padEnd(40)} ${r.w}x${r.h}  ` +
        `${r.clearPct}% clear, ${r.fringePx} soft, ${r.corrected} de-spilled  ->  ` +
        path.relative(process.cwd(), r.out)
    );
  } catch (e) {
    console.error(`${path.basename(src)}: ${e.message}`);
  }
}

console.log(`\n${(await readdir(OUT_DIR)).length} file(s) in public/images/yard/`);
