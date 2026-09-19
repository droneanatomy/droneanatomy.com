import { describe, expect, it } from 'vitest';
import { HOLD_MS, RING_DELAY_MS, isComplete, ringProgress, ringVisible } from './holdTiming';

describe('ringVisible', () => {
  /* An ordinary click on the ink must leave no trace. The reveal already
     responds to the pointer here, and a ring flashing on every press would
     turn a secret into a button. */
  it('shows nothing for a brief press', () => {
    expect(ringVisible(200)).toBe(false);
  });

  it('appears once the press outlasts the delay', () => {
    expect(ringVisible(RING_DELAY_MS)).toBe(true);
  });
});

describe('ringProgress', () => {
  /* THE BUG THIS EXISTS TO PREVENT: elapsed / HOLD_MS is 0.23 at the moment
     the ring becomes visible, so a naive version pops into view already a
     quarter drawn. The ring's own window starts where it appears. */
  it('starts empty at the moment the ring appears', () => {
    expect(ringProgress(RING_DELAY_MS)).toBe(0);
  });

  it('is exactly full when the hold completes', () => {
    expect(ringProgress(HOLD_MS)).toBe(1);
  });

  it('is half drawn halfway through its own window', () => {
    expect(ringProgress(RING_DELAY_MS + (HOLD_MS - RING_DELAY_MS) / 2)).toBeCloseTo(0.5, 10);
  });

  /* A frame can land after the deadline — rAF has no obligation to tick on
     the millisecond the hold ends — and a dashoffset past 1 draws backwards. */
  it('clamps when a frame overshoots the deadline', () => {
    expect(ringProgress(HOLD_MS * 2)).toBe(1);
  });

  it('is zero before the ring is visible', () => {
    expect(ringProgress(0)).toBe(0);
  });
});

describe('isComplete', () => {
  it('is not complete one millisecond early', () => {
    expect(isComplete(HOLD_MS - 1)).toBe(false);
  });

  it('is complete at the deadline', () => {
    expect(isComplete(HOLD_MS)).toBe(true);
  });
});
