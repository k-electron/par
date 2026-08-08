/**
 * The bar the field column draws, and the one property that justifies its being
 * logarithmic rather than linear.
 */

import { describe, expect, it } from 'vitest';

import { fieldFill } from '../../src/app/ui/field';

const START = 3000;

describe('the field bar', () => {
  it('draws a full field full and a settled one empty', () => {
    expect(fieldFill(START, START)).toBe(1);
    expect(fieldFill(1, START)).toBe(0);
  });

  it('shortens by the same amount for the same cut, wherever it happens', () => {
    // The reason for the log scale. On a linear bar the first halving would take
    // half the width and the fifth would take a thirty-second of it, so every
    // row after the opener would sit at a length the eye cannot separate from
    // the one below it.
    const halvings = [START, START / 2, START / 4, START / 8, START / 16].map((remaining) =>
      fieldFill(remaining, START),
    );

    const steps = halvings.slice(1).map((fill, index) => halvings[index]! - fill);
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0]!, 10);
    }
    expect(steps[0]).toBeGreaterThan(0);
  });

  it('only ever gets shorter as the field narrows', () => {
    let previous = fieldFill(START, START);
    for (const remaining of [1200, 253, 60, 9, 2, 1]) {
      const fill = fieldFill(remaining, START);
      expect(fill, `${remaining} of ${START}`).toBeLessThan(previous);
      previous = fill;
    }
  });

  it('stays a proportion whatever it is handed', () => {
    // A width outside [0, 1] would render as a bar overflowing its track or as
    // a negative one, so the clamp is not decoration.
    expect(fieldFill(START * 2, START)).toBe(1);
    expect(fieldFill(0, START)).toBe(0);
    // A field of one word has no range to draw against, and nothing survives
    // such a position anyway.
    expect(fieldFill(1, 1)).toBe(0);
    expect(fieldFill(1, 0)).toBe(0);
  });
});
