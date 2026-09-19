import { describe, expect, it } from 'vitest';
import { advanceClock, advancePhase, MAX_FRAME_SEC } from './flightBeats';

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

/* THE LOOP PHASE, and why it must be integrated.

   The idle loops (bob, drift, orbit, bank) were driven by
   phase = t / period, with `period` lerped between the two scenes during a
   transition. The phase then jumps by t x (1/periodA - 1/periodB) cycles
   across one blend — a number that grows with every second spent on the
   section. After five minutes, Approach (26s) to Transit (38s) swept 3.6
   extra cycles inside a single transition, which is the jitter in the
   recording: the aircraft flipping orientation frame to frame mid-blend.

   A longer transition does not help: the extra cycles depend on t and the
   periods only, so it would spread the same shake over more frames. */
describe('advancePhase', () => {
  const FPS = 60;
  const dt = 1 / FPS;
  const TRANSITION = 1.6;

  /* The phase step per frame while a period change plays out, starting at
     wall time `t0`. Returns the largest single-frame step. */
  const worstStep = (step: (t: number, blend: number, prev: number) => number, t0: number) => {
    let prev = step(t0, 0, 0);
    let worst = 0;
    for (let f = 1; f <= TRANSITION * FPS; f++) {
      const blend = f / (TRANSITION * FPS);
      const next = step(t0 + f * dt, blend, prev);
      worst = Math.max(worst, Math.abs(next - prev));
      prev = next;
    }
    return worst;
  };
  const periodAt = (blend: number) => 26 + (38 - 26) * blend;
  /* The most a frame may advance: one frame at the SHORTER period. */
  const bound = (dt / 26) * Math.PI * 2;

  it('documents the bug: recomputing t / period jumps further the longer the scene has run', () => {
    const recomputed = (t: number, blend: number) => (t / periodAt(blend)) * Math.PI * 2;
    expect(worstStep(recomputed, 10)).toBeLessThan(bound * 2);
    expect(worstStep(recomputed, 300)).toBeGreaterThan(bound * 10);
  });

  it('never steps more than one frame of the shorter period, however long the scene has run', () => {
    const integrated = (_t: number, blend: number, prev: number) => advancePhase(prev, dt, periodAt(blend));
    for (const t0 of [0, 10, 300, 3600]) {
      expect(worstStep(integrated, t0)).toBeLessThanOrEqual(bound + 1e-12);
    }
  });

  it('advances at exactly the period while the period is steady', () => {
    let phase = 0;
    for (let f = 0; f < 26 * FPS; f++) phase = advancePhase(phase, dt, 26);
    expect(phase).toBeCloseTo(Math.PI * 2, 6);
  });

  it('holds still on a zero or negative delta and refuses a sub-1s period', () => {
    expect(advancePhase(1.5, 0, 26)).toBe(1.5);
    expect(advancePhase(1.5, -1, 26)).toBe(1.5);
    expect(advancePhase(0, 1, 0)).toBeCloseTo(Math.PI * 2, 9);
  });
});
