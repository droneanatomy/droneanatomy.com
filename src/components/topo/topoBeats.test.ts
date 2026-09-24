import { describe, expect, it } from 'vitest';
import { PLATE_IN, TOPO, copyLift, copyOn, revealAt, scrimOn, titleOn, writtenHeight, type Line } from './topoBeats';

/* Sample the whole scroll at a fine step. Every property below is a claim
   about ORDER — what is visible when — so it is checked everywhere, not at
   a couple of hand-picked points that happen to pass. */
const SWEEP = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('the title', () => {
  it('is fully on when the section arrives', () => {
    expect(titleOn(0)).toBe(1);
  });

  it('has gone before the paragraph starts writing', () => {
    expect(titleOn(TOPO.reveal[0])).toBe(0);
  });
});

describe('the paragraph', () => {
  it('writes nothing before its window and everything after it', () => {
    expect(revealAt(TOPO.reveal[0])).toBe(0);
    expect(revealAt(TOPO.reveal[1])).toBe(1);
    expect(revealAt(1)).toBe(1);
  });

  /* Linear, not eased: each word should cost the same amount of scroll.
     An eased reveal writes the middle of the paragraph faster than its
     start and end, which reads as the text lurching under the thumb. */
  it('writes at an even pace', () => {
    const mid = (TOPO.reveal[0] + TOPO.reveal[1]) / 2;
    expect(revealAt(mid)).toBeCloseTo(0.5, 10);
  });

  it('never un-writes itself as the scroll advances', () => {
    let prev = 0;
    for (const p of SWEEP) {
      expect(revealAt(p)).toBeGreaterThanOrEqual(prev);
      prev = revealAt(p);
    }
  });

  /* Nobody should see a half-written paragraph dissolving. */
  it('is completely written before it starts to dissolve', () => {
    for (const p of SWEEP) {
      if (copyLift(p) > 0) expect(revealAt(p)).toBe(1);
    }
  });

  it('is held, fully written, for a real stretch of scroll', () => {
    expect(TOPO.copyOut[0] - TOPO.reveal[1]).toBeGreaterThanOrEqual(0.08);
  });

  /* The contour plate brings its own caption and markers; type over them
     would fight. */
  it('has fully gone by the time the plate caption arrives', () => {
    expect(copyOn(PLATE_IN)).toBe(0);
    for (const p of SWEEP) {
      if (p >= PLATE_IN) expect(copyOn(p)).toBe(0);
    }
  });
});

describe('the handover from title to paragraph', () => {
  it('never shows both at once', () => {
    for (const p of SWEEP) {
      expect(titleOn(p) > 0.5 && copyOn(p) > 0.5).toBe(false);
    }
  });
});

describe('writtenHeight — how much of the paragraph exists yet', () => {
  /* Four lines of 60px, starting at words 0, 7, 14 and 21 of 28, with the
     same stagger TopoBlock builds: each word fades over `fade` and the last
     one lands exactly at t = 1. */
  const n = 28;
  const fade = 4 / n;
  const step = (1 - fade) / (n - 1);
  const lines: Line[] = [
    { first: 0, h: 60 },
    { first: 7, h: 60 },
    { first: 14, h: 60 },
    { first: 21, h: 60 },
  ];
  const at = (t: number) => writtenHeight(t, lines, step, fade);
  const T = Array.from({ length: 2001 }, (_, i) => i / 2000);

  it('is nothing before the first word and the whole block after the last', () => {
    expect(at(0)).toBe(0);
    expect(at(1)).toBe(240);
  });

  /* The block climbs as it grows, so it must never climb back down while
     the reader scrolls forward. */
  it('only ever grows', () => {
    let prev = 0;
    for (const t of T) {
      expect(at(t)).toBeGreaterThanOrEqual(prev);
      prev = at(t);
    }
  });

  /* THE POINT OF THE FUNCTION. A new line must ease in with its first
     word rather than arriving whole, or the paragraph lurches up by half a
     line every time the writing wraps. The largest step between adjacent
     samples bounds that: a whole-line jump would be 60. */
  it('grows smoothly, never a line at a time', () => {
    let worst = 0;
    for (let i = 1; i < T.length; i++) worst = Math.max(worst, at(T[i]) - at(T[i - 1]));
    expect(worst).toBeLessThan(2);
  });

  it('holds still while the writing stays on one line', () => {
    /* Between the moment line 2's first word has fully faded in and the
       moment line 3's first word starts, nothing wraps. */
    const settled = 7 * step + fade;
    const nextWrap = 14 * step;
    expect(at(settled)).toBe(at(nextWrap));
  });
});

describe('the scrim', () => {
  /* It exists for legibility, so it must be up for as long as there are
     words on screen that someone is reading. */
  it('is fully up for the whole of the writing and the hold', () => {
    for (const p of SWEEP) {
      if (p >= TOPO.reveal[0] && p <= TOPO.copyOut[0]) expect(scrimOn(p)).toBe(1);
    }
  });

  it('is clear of the contour plate', () => {
    expect(scrimOn(PLATE_IN)).toBe(0);
  });
});
