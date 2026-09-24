/* ============================================================
   topoBeats — when each piece of the mountain section is on screen.

   Pure functions of the section's scroll progress p (0 → 1), kept apart
   from TopoBlock so the ORDER of things can be tested: the title hands
   over to the paragraph, the paragraph is written in full before it is
   allowed to dissolve, and it is gone before the contour plate brings its
   own caption and markers.

   The camera move in TopoSection is untouched by all of this. It is the
   same continuous scrub from profile to plan; these are only the words
   laid over it.

     0.00 – 0.18   the title, over the low profile
     0.18 – 0.52   the paragraph writes itself, word by word
     0.52 – 0.62   held, fully written — reading time
     0.62 – 0.72   dissolves as the camera arrives overhead
     0.74 →        the contour plate and its caption (TopoBlock)
   ============================================================ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const TOPO = {
  titleOut: [0.1, 0.18],
  copyIn: [0.14, 0.2],
  reveal: [0.18, 0.52],
  copyOut: [0.62, 0.72],
  scrimIn: [0.1, 0.18],
  scrimOut: [0.64, 0.74],
} as const;

/* Where the contour plate's caption starts to fade in. Exported so the
   plate and the paragraph share one number and cannot drift into
   overlapping each other. */
export const PLATE_IN = 0.74;

export const titleOn = (p: number) => 1 - smoothstep(TOPO.titleOut[0], TOPO.titleOut[1], p);

export const copyOn = (p: number) =>
  smoothstep(TOPO.copyIn[0], TOPO.copyIn[1], p) * (1 - smoothstep(TOPO.copyOut[0], TOPO.copyOut[1], p));

/* How much of the paragraph is written, 0 → 1. LINEAR on purpose: every
   word costs the same scroll, so the writing never lurches under the
   thumb the way an eased reveal does through its middle. */
export const revealAt = (p: number) => clamp01((p - TOPO.reveal[0]) / (TOPO.reveal[1] - TOPO.reveal[0]));

/* The dissolve, 0 → 1. Drives both the drift upwards and the softening,
   so the words leave as one gesture rather than two. */
export const copyLift = (p: number) => smoothstep(TOPO.copyOut[0], TOPO.copyOut[1], p);

/* ---- the paragraph climbs as it grows ------------------------------

   The reference keeps the WRITTEN part of the paragraph centred: the first
   line appears near the middle of the screen, and every line added below
   pushes the block up by half a line, so the text rises as it is written
   instead of sitting still and growing downwards.

   TopoBlock measures the laid-out lines once per split and hands them in
   here as { first word index, line height }. This returns how tall the
   written block is at timeline position t, and the paragraph is lifted by
   half of it.

   Each line eases in with its OWN FIRST WORD's fade rather than arriving
   whole the moment the writing wraps — otherwise the block would jump
   half a line every time a new line starts. Words that continue an
   existing line add nothing, so between wraps the block holds still. */
export type Line = { first: number; h: number };

export const writtenHeight = (t: number, lines: readonly Line[], step: number, fade: number) => {
  let h = 0;
  for (const line of lines) {
    const start = line.first * step;
    if (t <= start) break;
    h += line.h * smoothstep(start, start + fade, t);
  }
  return h;
};

/* The darkening behind the words. The reference drops the terrain toward
   black while it writes; this mountain runs near-white at the summit, so
   white body type over it needs the ground taken down to be read. It
   lingers a little past the dissolve so the words never sit on bare,
   bright terrain on their way out. */
export const scrimOn = (p: number) =>
  smoothstep(TOPO.scrimIn[0], TOPO.scrimIn[1], p) * (1 - smoothstep(TOPO.scrimOut[0], TOPO.scrimOut[1], p));
