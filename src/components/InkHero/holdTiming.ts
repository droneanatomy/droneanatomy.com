/* ============================================================
   holdTiming — the timing behind the hero's hidden way in.

   NAMED FOR THE TIMING, not for the gesture, because a `holdToFly.ts`
   beside `HoldToFly.tsx` differs only in casing: on a case-insensitive
   filesystem `import './HoldToFly'` resolves .ts before .tsx and quietly
   hands the component's importer this module instead.

   Press and hold on the ink and a ring draws itself at the pointer; let
   it close and the page hands you the aircraft. These are the rules that
   decide what the ring is doing at a given moment, kept apart from the
   component so they can be reasoned about — and tested — without a DOM.

   TWO WINDOWS, NOT ONE, and that is the whole subtlety here. The HOLD
   runs from the press to the deadline. The RING only starts once a press
   has outlasted RING_DELAY_MS, so an ordinary click leaves no trace at
   all — this is a secret, and a ring that flashes on every press is a
   button with extra steps. Drawing the ring from the hold's own progress
   would pop it into view already 23% full; it gets its own window.
   ============================================================ */

/* How long the hold runs. Long enough to be a decision rather than a
   slip, short enough that nobody lets go early wondering if it worked. */
export const HOLD_MS = 1100;

/* How long a press stays invisible. Past a quarter second nobody is
   clicking any more — they are holding, and holding is the gesture. */
export const RING_DELAY_MS = 250;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const ringVisible = (elapsedMs: number) => elapsedMs >= RING_DELAY_MS;

export const ringProgress = (elapsedMs: number) =>
  clamp01((elapsedMs - RING_DELAY_MS) / (HOLD_MS - RING_DELAY_MS));

export const isComplete = (elapsedMs: number) => elapsedMs >= HOLD_MS;
