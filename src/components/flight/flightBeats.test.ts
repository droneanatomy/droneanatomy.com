import { describe, expect, it } from 'vitest';
import { advanceClock, MAX_FRAME_SEC } from './flightBeats';

/* THE SCENE CLOCK, and the bug it exists to prevent.

   FlightScene's frame loop returns early when the section is out of view, so
   THREE.Clock is not read while the reader is elsewhere on the page. Its
   getDelta() measures wall time since the LAST READ, which means the whole
   absence arrives as one enormous delta on the frame the section comes back.

   Measured in the browser: six seconds away produced a single-frame jump of
   6.073s. The craft's bob, drift, orbit and bank are all sin(t / period), so
   with periods of six to ten seconds that is most of a cycle traversed in one
   frame — every one of them teleports at once. A transition in flight is cut
   short by the same jump, because its progress is (t - start) / duration.

   These tests pin the invariant that fixes both: the scene clock advances by
   real time while the scene is being watched, and by no more than one
   frame's worth however long it was away. */

describe('advanceClock', () => {
  it('advances by the delta on an ordinary frame', () => {
    expect(advanceClock(10, 1 / 60)).toBeCloseTo(10 + 1 / 60, 6);
  });

  it('caps a long absence at one frame, rather than replaying it', () => {
    /* The reported bug. Six seconds out of view must not become six seconds
       of animation on the frame that returns. */
    expect(advanceClock(10, 6.073)).toBeCloseTo(10 + MAX_FRAME_SEC, 6);
  });

  it('caps a backgrounded tab the same way', () => {
    expect(advanceClock(0, 600)).toBeCloseTo(MAX_FRAME_SEC, 6);
  });

  it('never runs backwards, whatever the clock reports', () => {
    /* A negative delta would rewind the loops, which reads as a stutter
       rather than a jump but is the same defect. */
    expect(advanceClock(10, -5)).toBe(10);
  });

  it('is monotonic across a long run of mixed deltas', () => {
    let t = 0;
    let prev = 0;
    for (const d of [1 / 60, 1 / 30, 12, -1, 0, 1 / 120, 900]) {
      t = advanceClock(t, d);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('survives a NaN delta instead of poisoning the scene forever', () => {
    /* phase is t * 2PI / period. One NaN in the accumulator makes every
       later frame NaN, so the aircraft does not glitch — it disappears and
       never comes back. Cheaper to refuse the value than to debug that. */
    expect(advanceClock(10, Number.NaN)).toBe(10);
    expect(advanceClock(10, Number.POSITIVE_INFINITY)).toBeCloseTo(10 + MAX_FRAME_SEC, 6);
  });
});
