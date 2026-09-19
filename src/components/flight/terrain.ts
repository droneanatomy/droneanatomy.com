/* ============================================================
   terrain — real relief, generated. No download required.

   The reference ships terrain.glb at 2.0 MB. This is 0 bytes, because
   ridged noise gives genuine landforms — ridgelines, valleys, scree
   slopes — and the only thing a downloaded mesh buys over it is a
   SPECIFIC, recognisable place. Nothing in this flight needs the land to
   be anywhere in particular, and a mesh cannot be retuned mid-review
   whereas these constants can.

   Where a real asset does start to earn its weight:
     · a named location the viewer should recognise
     · photogrammetric detail at low altitude, which noise cannot fake
     · art-directed silhouettes, when the ridgeline has to frame a shot

   If one is ever swapped in: keep TERRAIN_SIZE and keep y=0 as sea level,
   and every camera leg and altitude in FlightScene stays valid.

   RIDGED multifractal rather than plain fbm. Plain fbm gives rolling
   hills — the valleys and the peaks are equally round, which reads as
   dunes. Folding it (1 - |2n-1|) creates creases, and creases are what
   the eye reads as rock.
   ============================================================ */

import * as THREE from 'three';

export const TERRAIN_SIZE = 1600;

/* The land REPEATS every this many world units along Z, exactly.

   That is what lets the terrain scroll forever under a stationary craft:
   translate the mesh by -(distance % LOOP) and, because the height field
   is genuinely periodic, the wrap is not a seam — it is the same ground.

   The alternative is leapfrogging tiles and hiding the join in fog, which
   costs a full 90k-vertex rebuild every time a tile recycles. Periodic
   noise costs nothing at all: the mesh is built once and only its
   position changes. */
export const LOOP = 2400;

/* Lattice cells spanned by one LOOP at the base octave.

   Must be an INTEGER, because the periodicity comes from wrapping the
   integer lattice index and a fractional period has nothing to wrap to.

   It also has to be big enough for the SLOWEST octave in use. The mask
   below samples at 0.5x, so its period is LAT/2 cells — at LAT=2 that is
   a single cell, and wrapping mod 1 pins every lookup to the same lattice
   row, which flattens that octave to a constant. 6 is the smallest value
   that leaves every call at least 3 cells to vary across. */
const LAT = 6;
const S = LAT / LOOP;

const wrapi = (i: number, n: number) => ((i % n) + n) % n;

/* Deterministic, so a camera leg framed against a ridge stays framed
   against that same ridge on every load. */
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

/* Value noise, PERIODIC in y with period `ny` lattice cells.

   Only y wraps. The craft flies along Z and never travels in X, so making
   both axes periodic would halve the variety for nothing.

   THE RULE for every caller: if you sample at `v * k`, you must pass
   `ny = LAT * k`. Getting this wrong is silent — the terrain still looks
   fine standing still, and only reveals itself as a jump when the mesh
   wraps. It cost 17 units of seam the first time. */
const noise = (x: number, y: number, ny = 0) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const y0 = ny ? wrapi(iy, ny) : iy;
  const y1 = ny ? wrapi(iy + 1, ny) : iy + 1;
  return (
    hash(ix, y0) * (1 - ux) * (1 - uy) +
    hash(ix + 1, y0) * ux * (1 - uy) +
    hash(ix, y1) * (1 - ux) * uy +
    hash(ix + 1, y1) * ux * uy
  );
};

/* The fold is the whole trick: |2n-1| creates a crease wherever the noise
   crosses its midpoint, and stacking creases at halving amplitude builds
   ridgelines that branch the way real ones do. `prev` weights each octave
   by the one above it, so detail collects on the ridges and the valleys
   stay smooth — which is what erosion actually does. */
/* Lacunarity is EXACTLY 2, not 2.04.

   Each octave samples at double the frequency, so its lattice period is
   double too — 2, 4, 8 cells. Any other multiplier lands the octaves on
   periods that never share a common wrap, and the terrain stops tiling.
   The cost is that octaves align rather than beating against each other,
   which is a small loss of variety for an exact loop. */
const ridged = (x: number, y: number, oct = 6, ny = 0) => {
  let sum = 0, amp = 0.5, freq = 1, prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = noise(x * freq, y * freq, ny ? ny * freq : 0);
    n = 1 - Math.abs(n * 2 - 1);
    n *= n;
    sum += n * amp * prev;
    prev = n;
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
};

const fbm = (x: number, y: number, oct = 4, ny = 0) => {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise(x * f, y * f, ny ? ny * f : 0);
    f *= 2;
    a *= 0.5;
  }
  return v;
};

export const PEAK = 240;

/* Height in world units. Exported because craft need to hold altitude
   above the LAND, not above zero — over relief this size the difference
   is the whole flight. */
/* ============================================================
   THE BAKED TERRAIN.

   Height and colour now come from a real place — a photogrammetry
   landscape, re-projected. Both plates were rendered from one overhead
   orthographic camera so they register with each other exactly, which
   mattered because the source mesh's UVs are an ATLAS: every correlation
   between UV and world XY measured at about zero, so the colour could not
   be produced by cropping the source texture. It had to be re-projected.

   MADE PERIODIC, because the scroll depends on it. FlightScene moves the
   land with `terrain.position.z = flown % LOOP` and needs the field to
   repeat exactly over LOOP. Photogrammetry does not repeat, so a tile was
   cut SHORTER than the baked plate and its head cross-faded into the rows
   one tile-length further down — the only arrangement where row T-1 is
   followed naturally by row 0. Measured wrap: 1.37 world units against a
   0.77 unit row step. Not zero, because blending two different pieces of
   ground cannot match gradients exactly, but well under one triangle.

   THE NOISE BELOW IS STILL THE FALLBACK. groundAt is called synchronously
   by trees, thermalField, sensorCone and thermalProjection — the last at
   roughly 1,800 calls a frame — so it cannot wait on a fetch. Until the
   plates land it answers from the ridged noise, exactly as before, and
   the scene upgrades in place when they arrive. */

/* Straight from the bake. Asserted at load rather than trusted. */
const DEM_W = 512;
const DEM_H = 630;

let dem: Uint16Array | null = null;
let albedo: THREE.Texture | null = null;
let ready: Promise<void> | null = null;

/* Starts the fetch on first call and hands the same promise to everyone
   after. Nothing here throws: a failed fetch leaves the noise in place,
   which is a worse-looking scene rather than a broken one. */
/* Set by the scene once a renderer exists — three cannot know the limit
   before then. 8 until told otherwise, which is what it used to be. */
let maxAnisotropy = 8;
export function setTerrainAnisotropy(n: number) {
  maxAnisotropy = Math.max(1, n);
}

export function terrainReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const [buf, tex] = await Promise.all([
      fetch('/terrain/height.bin').then((r) => r.arrayBuffer()),
      new THREE.TextureLoader().loadAsync('/terrain/albedo.webp'),
    ]);
    const u16 = new Uint16Array(buf);
    if (u16.length !== DEM_W * DEM_H) {
      throw new Error(`height.bin is ${u16.length}, expected ${DEM_W * DEM_H}`);
    }
    /* flipY OFF so texture V=0 is the FIRST row of the image, which is the
       row groundAt calls z=0. With three's default the picture would be
       upside down relative to the heights it is painted on — and because
       both are smooth terrain, that reads as "slightly wrong" rather than
       as an obvious bug. */
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    /* Whatever the GPU allows, rather than 8. The land is almost always
       seen at a grazing angle here — that is what a flyover is — and
       grazing is exactly where anisotropy earns its keep. It costs
       sampling bandwidth, not memory or download. */
    tex.anisotropy = maxAnisotropy;
    dem = u16;
    albedo = tex;
  })().catch((e) => {
    console.warn('[terrain] baked plates unavailable, staying on noise:', e);
  });
  return ready;
}

/* Bilinear, wrapping in Z and clamping in X.

   Wrapping is not a nicety here: it is the same modulo the scroll uses, so
   a sample at z and one at z+LOOP have to return the same number to the
   bit, or the craft would step as the land wrapped underneath it. */
function demAt(x: number, z: number) {
  const d = dem!;
  const u = (x / TERRAIN_SIZE + 0.5) * (DEM_W - 1);
  const v = (((z % LOOP) + LOOP) % LOOP) / LOOP * DEM_H;

  const x0 = Math.max(0, Math.min(DEM_W - 1, Math.floor(u)));
  const x1 = Math.min(DEM_W - 1, x0 + 1);
  const fx = Math.max(0, Math.min(1, u - x0));

  const y0 = Math.floor(v) % DEM_H;
  const y1 = (y0 + 1) % DEM_H;
  const fy = v - Math.floor(v);

  const a = d[y0 * DEM_W + x0], b = d[y0 * DEM_W + x1];
  const c = d[y1 * DEM_W + x0], e = d[y1 * DEM_W + x1];
  const top = a + (b - a) * fx;
  const bot = c + (e - c) * fx;
  return ((top + (bot - top) * fy) / 65535) * PEAK;
}

/* NOISE FALLBACK — see terrainReady above. */
function noiseAt(x: number, z: number) {
  /* Both axes on the same scale so the land is isotropic, and that scale
     is fixed by the loop length rather than chosen by eye. */
  const u = x * S, v = -z * S;

  /* A broad mask so the range rises and falls across the map instead of
     covering it edge to edge — flying over unbroken mountain is as
     monotonous as flying over unbroken flat.

     FLOORED AT 0.4, and that matters. fbm averages about 0.25, not 0.5,
     so an unfloored mask quartered the whole range. Multiplied by ridged
     noise, which also sits near 0.22 typically, the two dampeners
     compounded: a nominal PEAK of 210 produced 11 units of actual relief
     and the map read as damp grassland. Measured, not guessed. */
  // sampled at 0.5x, so the period is LAT * 0.5
  const mask = 0.4 + 0.6 * smooth(fbm(u * 0.5 + 3, v * 0.5 + 9, 3, LAT * 0.5) * 1.6);

  /* Normalised to its own working maximum, then gamma-lifted. Ridged
     noise concentrates its value on the ridgelines and leaves the rest
     near zero, which is correct for where PEAKS go and wrong for where
     the LAND sits — the gamma raises the valley floors without flattening
     the tops. */
  const r = Math.pow(Math.min(1, ridged(u, v, 6, LAT) / 0.62), 0.65);

  // valley floor sits below zero so water reads where it collects
  return r * mask * PEAK - 30 + fbm(u * 4, v * 4, 2, LAT * 4) * 5;
}

const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/* Colour by elevation AND SLOPE, baked to vertex colours.

   Vertex colours rather than a texture because this surface's detail is
   low frequency — the bands follow the landform itself. No texture to
   download, no UV seams, and no anisotropy cost at grazing angles, which
   is most of what an aerial camera sees.

   SLOPE is the half I left out first time, and it is the half that makes
   terrain read as rock. Elevation alone paints horizontal stripes: every
   point at the same height gets the same colour whether it is a valley
   floor or a cliff face. Real ground does the opposite — anything steep
   sheds soil and shows rock at ANY altitude. Mixing slope in is what
   turns banded hills into mountains.

   The bands are placed against the terrain's MEASURED distribution
   rather than spread evenly over 0..1, and the measurement is worth
   re-taking rather than trusting: a profile of "p50 58, p95 172" was
   carried around for a while and is wrong by more than a whole band. The
   real figures, read off the built geometry, are

       p05 39   p25 89   p50 133   p75 171   p90 196   p95 207   max 213

   which through t = (h + 30) / PEAK gives t of 0.29 / 0.50 / 0.68 / 0.84.
   The median sits at 0.68 — over two thirds of the way up the range — so
   any band scheme that treats the middle of 0..1 as the middle of the
   terrain puts most of the map in its top bands. That is the whole reason
   this looked like sand rather than hills.

   TO RE-MEASURE, build the geometry and read the position attribute's z
   (the plane is still in XY at that point, so z is height). Do not infer
   it from PEAK — PEAK is the normalising constant, not the maximum the
   noise actually reaches. */
function paint(geo: THREE.PlaneGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const rock = new THREE.Color();

  const ROCK = new THREE.Color('#6f665a');
  const ROCK_DK = new THREE.Color('#4e4740');
  const SCREE = new THREE.Color('#8d8374');
  /* GREEN, AND DELIBERATELY LIGHT, which is the part that is easy to get
     wrong twice.

     These started muted (#59663f and #3f4a2b) and read as brown-olive
     under the haze, so the obvious move was to saturate them. That works
     for hue and fails for everything else: a saturated mid-green is a
     DARK colour, much darker than the scree it replaced, and this
     section's copy is ink with the nav dark over it. Measured after that
     pass, body copy over the hillside fell to 2.0:1 against the 4.5:1 it
     needs — the terrain went green by going dim.

     So these are picked for luminance first and hue second. Rec.709 luma
     runs LOW 90, GRASS 136, GRASS_HI 160, which brackets the old SCREE
     (133) that used to carry most of the map — the ground keeps roughly
     the brightness the copy was set against, and spends its colour budget
     on being green rather than on being deep. Upland grass in flat
     daylight is genuinely this pale; the saturated version was reading as
     rainforest anyway, which is not what this landform is.

     ANY EDIT HERE MOVES TEXT CONTRAST. Re-measure the copy over the
     terrain before keeping a darker value. */
  const GRASS = new THREE.Color('#7d9155');
  /* Upland grass: lighter and a shade yellower than GRASS, so the green
     stretch does not have to be one flat colour — see the plateau in the
     band list below. */
  const GRASS_HI = new THREE.Color('#97a86d');
  const LOW = new THREE.Color('#4a6238');
  const SNOW = new THREE.Color('#eeedec');

  for (let i = 0; i < pos.count; i++) {
    const h = pos.getZ(i);
    /* Raw, not smoothstepped. The smoothstep was compressing the middle
       of the range into the bottom band — smooth(0.37) is 0.31 — which
       moved most of the map a whole band downward. */
    const t = Math.min(1, Math.max(0, (h + 30) / PEAK));

    /* FIVE BANDS, AND THE MIDDLE ONE IS A PLATEAU. That shape is the
       point, so it is worth saying why it is not the obvious four.

       With four bands the green one has to span everything from the
       valley floor to the treeline, and it spans it as a single lerp into
       scree — which means the MEDIAN vertex lands halfway between grass
       and tan, and halfway between grass and tan is olive. Measured, that
       came out at 14% green against 68% tan-or-rock even with the band
       edges already moved: the map was not too high any more, it was just
       dissolving into scree across its whole middle. Widening the band
       does not fix that, because the midpoint of a wider band is still its
       midpoint.

       So the greens get a range they simply HOLD across — GRASS to
       GRASS_HI, two greens rather than one, so the plateau still has
       relief in it and does not read as flat paint. Scree is then a real
       transition at real altitude instead of something the whole hillside
       is always partway into.

       Edges against the measured t (p05 0.29, p25 0.50, p50 0.68,
       p75 0.84, p90 0.94):

         < 0.30  LOW -> GRASS      valley floor, deepest green
         < 0.72  GRASS -> GRASS_HI the green plateau
         < 0.90  GRASS_HI -> SCREE treeline, green giving out
         < 0.97  SCREE -> ROCK     mineral ground
         else    ROCK -> SNOW      the very tops

       The plateau runs to 0.72 rather than stopping at the median,
       because of WHAT THE CAMERA ACTUALLY SEES. These beats look across
       ridge tops from above, so the high ground fills most of the frame
       and the valleys — however green — are slivers between it. Bands set
       to make the median green still leave the visible mass mineral. The
       green has to reach up the slopes, not just sit in the bottom of
       them, and the mineral bands have to be squeezed into the top tenth
       where actual bare rock lives. */
    if (t < 0.30) c.copy(LOW).lerp(GRASS, t / 0.30);
    else if (t < 0.72) c.copy(GRASS).lerp(GRASS_HI, (t - 0.30) / 0.42);
    else if (t < 0.90) c.copy(GRASS_HI).lerp(SCREE, (t - 0.72) / 0.18);
    else if (t < 0.97) c.copy(SCREE).lerp(ROCK, (t - 0.90) / 0.07);
    else c.copy(ROCK).lerp(SNOW, smooth((t - 0.97) / 0.03));

    /* Slope from the vertex normal. The plane is built in XY and rotated
       later, so its up axis here is Z: a normal pointing straight up has
       nz near 1, a cliff has nz near 0. */
    const nz = Math.abs(nrm.getZ(i));
    /* THRESHOLD MOVED, and it matters as much as the bands above. At 0.55
       anything past about a 56-degree slope counted as fully steep, and on
       relief this size that is a large share of the map — so even after
       widening the green bands, most of it would have been overwritten
       with rock anyway. Cliffs should go to rock; hillsides should not.
       Full rock now needs roughly 70 degrees, fading out by 47. */
    const steep = 1 - smooth(Math.min(1, Math.max(0, (nz - 0.34) / 0.34)));

    // steep ground goes to rock, and the steepest goes to shadowed rock
    rock.copy(ROCK).lerp(ROCK_DK, steep * 0.55);
    /* 0.7, down from 0.85: even a genuine cliff keeps a trace of what it
       is growing out of, which is what stops the transition reading as a
       hard mask between two different terrains. */
    c.lerp(rock, steep * 0.7);

    /* Two scales of mottle. The fine one breaks the banding so the
       transitions do not read as contour lines; the broad one varies the
       rock so a cliff face is not one flat colour. */
    const fine = (hash(pos.getX(i) * 0.7, pos.getY(i) * 0.7) - 0.5) * 0.055;
    const broad = (fbm(pos.getX(i) * S * 8, pos.getY(i) * S * 8, 2, LAT * 8) - 0.5) * 0.09;
    const j = fine + broad;

    colors[i * 3] = c.r + j;
    colors[i * 3 + 1] = c.g + j;
    colors[i * 3 + 2] = c.b + j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/* The one entry point everything else uses. */
export function groundAt(x: number, z: number) {
  return dem ? demAt(x, z) : noiseAt(x, z);
}

/* UVs derived from the SAME formula groundAt uses, rather than left as
   the plane's default 0..1. Two reasons. The colour has to land on the
   shape it was baked from, and the default UVs would stretch one tile
   across both loops of the mesh. And V is left running continuously
   (z / LOOP, so -1..1 across the mesh) instead of wrapped into 0..1 —
   a wrapped V would put a row of vertices where it jumps 1 -> 0, and the
   quad between them would smear the entire texture backwards. Repeat
   wrapping on the texture does the same job with no seam. */
function writeUVs(geo: THREE.PlaneGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = -pos.getY(i); // plane is XY before rotation; its Y is world -Z
    uv.setXY(i, x / TERRAIN_SIZE + 0.5, z / LOOP);
  }
  uv.needsUpdate = true;
}

/* Swap the noise-built land for the baked one, in place.

   Called once the plates arrive. The mesh, its material and every
   reference FlightScene holds stay valid — only the numbers change — so
   nothing has to be torn down and rebuilt mid-scroll.

   vertexColors goes OFF as the map goes on. Leaving it would multiply the
   painted bands into the photograph and darken it twice. */
export function refreshTerrain(mesh: THREE.Mesh) {
  if (!dem || !albedo) return;
  const geo = mesh.geometry as THREE.PlaneGeometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, groundAt(pos.getX(i), -pos.getY(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.map = albedo;
  mat.vertexColors = false;
  mat.color.setRGB(1, 1, 1);
  mat.needsUpdate = true;
}

export function buildTerrain(): THREE.Mesh {
  /* 300 segments over 1600 units — about 5 units per triangle edge.
     Ridged noise needs the resolution that farmland did not: the creases
     ARE the silhouette, and an under-sampled ridge reads as a smooth
     lump. 90k vertices is still nothing for a GPU. */
  /* Two loops deep. The mesh scrolls by up to one LOOP before wrapping,
     so it has to carry a second loop's worth of land ahead of the craft or
     the far edge would slide into view as it travels. */
  /* 460 x 800, up from 300 x 520.

     The old grid put one quad every 5.33 x 9.23 world units against a
     height field that already carries detail every 3.12 — the geometry
     was undersampling its own DEM, so relief the heightmap knew about
     never reached the silhouette. 460 x 800 brings the quads to
     3.48 x 6.00, which is about as fine as a 512-wide DEM can feed.

     The cost is 281k vertices against 157k. That is affordable now in a
     way it was not before: this scene used to carry 36k instanced
     conifers and a per-frame thermal projection over the same terrain,
     and both are gone. */
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, LOOP * 2, 460, 800);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    // plane is XY before rotation, so its Y maps to world -Z
    pos.setZ(i, groundAt(pos.getX(i), -pos.getY(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  paint(geo);
  writeUVs(geo);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/* Still water at the height the valleys bottom out, so the low ground
   reads as drainage rather than as dark rock. One quad, no reflection —
   at altitude a reflection is a highlight, and fog eats it anyway. */
export function buildWater(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE),
    new THREE.MeshStandardMaterial({
      color: '#4f4a40', roughness: 0.16, metalness: 0.62,
      transparent: true, opacity: 0.92,
    })
  );
  m.rotation.x = -Math.PI / 2;
  /* Just above the lowest ground. At -18 against the old flat terrain it
     drowned 32% of the map in one flat sheet, which read as a bay rather
     than as drainage. */
  m.position.y = -26;
  return m;
}

/* ============================================================
   GRAIN — sub-texel detail for the stylised terrain.

   WHY IT IS SOFT WITHOUT THIS. albedo.webp is 2048 x 2519 laid over
   TERRAIN_SIZE x LOOP = 1600 x 2400 units, so one texel covers 0.78 units
   across and 0.95 along. From the opening camera — about 230 units over
   the ground, 31 degrees down, a 22.9-degree lens — one screen pixel covers
   roughly 0.2 units across and 0.4 into the distance. Every texel is
   therefore spread over two to four pixels, and bilinear filtering fills
   them with a smooth ramp: the land reads as smeared rather than as
   ground. Anisotropy is already at the GPU's maximum and cannot help —
   it fixes MINIFICATION at grazing angles, and this is magnification.

   WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT.
     - a brightness grain at 4-unit and 1-unit scale, finer than the plate;
     - a normal perturbation at 2-unit scale, finer than the 3.5 x 6-unit
       mesh quads, so the sun picks out relief the geometry cannot carry;
     - roughness varied with the same field.
   It is all CENTRED ON ONE. The grain averages to the plate's own colour
   and the bump to the mesh's own normal, so the section's measured
   brightness — which the white copy's legibility was checked against —
   does not move. This is not photoreal.ts's attachTerrainDetail, whose
   colour grade (34% saturation, 62% brightness, a highlight rolloff)
   would restyle the whole beat; that mode keeps its own layer and this
   one is attached only when it is off.

   IT RIDES THE LAND, NOT THE WORLD. The terrain scrolls by
   `position.z = flown % LOOP`, so world-space noise would slide across the
   ground as it moved and then jump by a full loop at every wrap. The
   samples come from the mesh's own UVs instead, which writeUVs sets to
   (x / TERRAIN_SIZE + 0.5, z / LOOP): multiplied back up they are land
   coordinates in world units, and they move with the land.

   AND IT REPEATS EXACTLY OVER LOOP. At the wrap the ground under the
   camera changes from uv.y to uv.y - 1, which is a 2400-unit jump in these
   coordinates. Each noise's lattice is taken modulo its own period — 2400
   cells at 1 per unit, 1200 at 0.5, 600 at 0.25 — so a sample and the one
   a loop further on hash to the same cell and the wrap stays invisible.

   IT FADES BEFORE IT CAN SHIMMER. Procedural detail is the classic source
   of sparkle in a flyover: once a noise cell is smaller than a pixel it
   aliases into crawling noise, which is far worse than the blur it was
   meant to fix. Each layer reads the fragment's own footprint from
   screen-space derivatives and fades out as its cells approach a pixel,
   so it is present where the ground is close and gone before it can
   alias toward the horizon.
   ============================================================ */

const GRAIN_COMMON = `
  varying vec2 vTgUv;

  float tgHash(vec2 i, float py) {
    i.y = mod(i.y, py);
    return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123);
  }
  /* Value noise whose lattice repeats every py cells along the flight
     axis. py times the frequency must equal LOOP for a seamless wrap. */
  float tgNoise(vec2 p, float py) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(tgHash(i, py), tgHash(i + vec2(1.0, 0.0), py), u.x),
               mix(tgHash(i + vec2(0.0, 1.0), py), tgHash(i + vec2(1.0, 1.0), py), u.x), u.y);
  }
`;

export function attachTerrainGrain(terrain: THREE.Mesh): { dispose: () => void } {
  const mat = terrain.material as THREE.MeshStandardMaterial;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  /* Periods in LATTICE CELLS, derived rather than typed, so a change to
     LOOP cannot quietly break the wrap. */
  const pFine = (LOOP * 1.0).toFixed(1);
  const pBump = (LOOP * 0.5).toFixed(1);
  const pBump2 = (LOOP * 1.25).toFixed(1);
  const pMed = (LOOP * 0.25).toFixed(1);
  const size = TERRAIN_SIZE.toFixed(1);
  const loop = LOOP.toFixed(1);

  mat.onBeforeCompile = (shader, renderer) => {
    /* Chained, never assigned — see the same note in photoreal.ts. */
    prev?.call(mat, shader, renderer);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTgUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTgUv = uv;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GRAIN_COMMON)
      /* After color_fragment, so it lands on the plate's colour when the
         map is bound and on the painted bands in the noise fallback before
         it arrives. Declared at main scope, not in a block: the roughness
         and normal splices further down read these. */
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 tgP = vec2(vTgUv.x * ${size}, vTgUv.y * ${loop});
        /* World units covered by one screen pixel, here. */
        float tgPx = max(length(dFdx(tgP)), length(dFdy(tgP)));
        float tgNM = tgNoise(tgP * 0.25, ${pMed});
        float tgNF = tgNoise(tgP * 1.0, ${pFine});
        /* Each fades as its cell nears a pixel: 4-unit cells over 1.4-3.6
           units a pixel, 1-unit cells over 0.35-0.9. */
        float tgAM = 1.0 - smoothstep(1.4, 3.6, tgPx);
        float tgAF = 1.0 - smoothstep(0.35, 0.9, tgPx);
        diffuseColor.rgb *= 1.0 + 0.11 * tgAM * (tgNM - 0.5) + 0.08 * tgAF * (tgNF - 0.5);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 1.0 + 0.10 * tgAM * (tgNM - 0.5);`
      )
      /* normal is VIEW space at this point. The perturbation is built in
         world space — the land's own x and z — and carried into view space
         by viewMatrix, rather than added to a view-space vector as though
         the two were the same frame. */
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          /* TWO OCTAVES AT UNRELATED SIZES. One octave at a single size is
             a lattice, and the first pass showed it as one — an even
             hammered-metal stipple, every cell the same. 2-unit cells plus
             0.8-unit cells offset off the first lattice break the grid up.
             Both periods are whole numbers of cells per LOOP (1200, 3000),
             so the wrap still holds.

             TUNED BY MEASUREMENT, not by eye alone. Mean Laplacian over a
             strip of the opening frame, a crude but honest measure of fine
             detail: 2.38 with no grain, 8.13 at the first strength of 0.6
             and a single octave — 3.4x, far past the brief of a little.
             0.3 across two octaves is the second pass. */
          float tgAN = 1.0 - smoothstep(0.7, 1.8, tgPx);
          float tgAN2 = 1.0 - smoothstep(0.28, 0.72, tgPx);
          if (tgAN > 0.001) {
            float e = 0.35;
            vec2 q = tgP * 0.5;
            float h0 = tgNoise(q, ${pBump});
            vec2 g = vec2(tgNoise(q + vec2(e, 0.0), ${pBump}) - h0,
                          tgNoise(q + vec2(0.0, e), ${pBump}) - h0) / e * 0.5 * tgAN;
            vec2 q2 = tgP * 1.25 + vec2(17.3, 5.7);
            float k0 = tgNoise(q2, ${pBump2});
            g += 0.45 * tgAN2 * vec2(tgNoise(q2 + vec2(e, 0.0), ${pBump2}) - k0,
                                     tgNoise(q2 + vec2(0.0, e), ${pBump2}) - k0) / e * 1.25;
            vec3 bumpW = vec3(-g.x, 0.0, -g.y) * 0.3;
            normal = normalize(normal + (viewMatrix * vec4(bumpW, 0.0)).xyz);
          }
        }`
      );
  };

  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|terrain-grain';
  mat.needsUpdate = true;

  return {
    dispose: () => {
      mat.onBeforeCompile = prev ?? (() => {});
      mat.customProgramCacheKey = prevKey ?? (() => '');
      mat.needsUpdate = true;
    },
  };
}
