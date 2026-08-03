import { describe, expect, it } from 'vitest';

import { log2, weightedLog2Table } from '../../src/engine/numeric/log2';
import { float64Bits, ulpsApart } from '../support/bits';

/**
 * The engine's own `log2`. Two separate things need proving, and neither implies
 * the other:
 *
 * - that it is *right* — asserted against `Math.log2`, which is accurate even
 *   though it is not reproducible;
 * - that it is *fixed* — asserted against golden bit patterns, so any future
 *   edit to the series or the reduction has to be a deliberate one.
 */

/** A power of two built without Math.pow, which the engine may not use. */
function twoTo(exponent: number): number {
  let value = 1;
  for (let step = 0; step < Math.abs(exponent); step += 1) {
    value = exponent > 0 ? value * 2 : value / 2;
  }
  return value;
}

describe('log2 is correct', () => {
  it('is exact at every power of two, including the subnormal ones', () => {
    // `log2(1) === 0` exactly is load-bearing: spec §3 gives a single-candidate
    // guess the aggregation weight log2(1) = 0, so it must contribute nothing.
    expect(log2(1)).toBe(0);

    for (let exponent = -1074; exponent <= 1023; exponent += 1) {
      const value = twoTo(exponent);
      if (value === 0 || !Number.isFinite(value)) {
        continue;
      }
      expect(log2(value), `2 ** ${exponent}`).toBe(exponent);
    }
  });

  it('is within one ULP of Math.log2 across the candidate-count range', () => {
    // Every count the scorer takes a logarithm of is a candidate count, so this
    // range is the one that matters. It is checked densely rather than sampled.
    for (let count = 1; count <= 20000; count += 1) {
      expect(ulpsApart(log2(count), Math.log2(count)), `log2(${count})`).toBeLessThanOrEqual(1);
    }
  });

  it('is within one ULP of Math.log2 well outside that range too', () => {
    const values = [
      Number.MIN_VALUE,
      1e-308,
      2.2250738585072014e-308,
      1e-30,
      0.1,
      0.3,
      0.7071067811865476,
      1.0000000000000002,
      1.4142135623730951,
      1.9999999999999998,
      1e6,
      1e30,
      1e308,
      Number.MAX_VALUE,
    ];

    for (const value of values) {
      expect(ulpsApart(log2(value), Math.log2(value)), `log2(${value})`).toBeLessThanOrEqual(1);
    }
  });

  it('handles the edges the way Math.log2 does', () => {
    expect(log2(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(log2(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(log2(-1)).toBeNaN();
    expect(log2(-0.5)).toBeNaN();
    expect(log2(Number.NaN)).toBeNaN();
  });
});

describe('log2 is fixed', () => {
  /**
   * Bit patterns, not decimals. A golden written as a decimal would pass on a
   * value that differed in the last bit, which is exactly the divergence spec §5
   * is about. Regenerate these only alongside a deliberate change to the kernel.
   */
  const GOLDEN_BITS: readonly [number, string][] = [
    [1, '0000000000000000'],
    [2, '3ff0000000000000'],
    [3, '3ff95c01a39fbd69'],
    [5, '4002934f0979a371'],
    [7, '400675767f54042d'],
    [10, '400a934f0979a371'],
    [15, '400f414fdb498226'],
    [16, '4010000000000000'],
    [60, '4017a0a7eda4c113'],
    [100, '401a934f0979a371'],
    [200, '401e934f0979a371'],
    [243, '401fb3020c87acc3'],
    [1000, '4023ee7b471b3a95'],
    [2315, '40265a8511676243'],
    [2999, '402719bc70993772'],
    [3000, '402719fb7b8f3242'],
    [12972, '402b5383966ab858'],
    [0.5, 'bff0000000000000'],
    [0.1, 'c00a934f0979a371'],
    [1.5, '3fe2b803473f7ad2'],
    [1e-6, 'c033ee7b471b3a95'],
    [1e6, '4033ee7b471b3a95'],
  ];

  it.each(GOLDEN_BITS)('log2(%s) is bit-for-bit %s', (value, bits) => {
    expect(float64Bits(log2(value))).toBe(bits);
  });

  it('gives the same bits every time it is called', () => {
    // Guards against internal state leaking between calls: the module reuses one
    // DataView for exponent reads, and a bug there would show up as a value that
    // depended on what had been computed before it.
    const first = [...Array(64).keys()].map((index) => float64Bits(log2(index + 1)));
    for (let round = 0; round < 3; round += 1) {
      const again = [...Array(64).keys()].map((index) => float64Bits(log2(index + 1)));
      expect(again).toEqual(first);
    }
  });

  it('does not depend on the order the calls arrive in', () => {
    const ascending = new Map<number, string>();
    for (let count = 1; count <= 500; count += 1) {
      ascending.set(count, float64Bits(log2(count)));
    }
    for (let count = 500; count >= 1; count -= 1) {
      expect(float64Bits(log2(count))).toBe(ascending.get(count));
    }
  });
});

describe('the weighted table the ranking reads', () => {
  const table = weightedLog2Table(300);

  it('holds n log2 n', () => {
    for (let count = 2; count <= 300; count += 1) {
      expect(table[count]).toBe(count * log2(count));
    }
  });

  it('contributes nothing for an empty or singleton bucket', () => {
    // Spec §3's first guard clause: an empty partition must not produce NaN. A
    // zero entry meets it by construction, with no branch to forget.
    expect(table[0]).toBe(0);
    expect(table[1]).toBe(0);
  });

  it('is as long as it was asked for', () => {
    expect(table).toHaveLength(301);
    expect(weightedLog2Table(0)).toHaveLength(1);
    expect(() => weightedLog2Table(-1)).toThrow(RangeError);
    expect(() => weightedLog2Table(1.5)).toThrow(RangeError);
  });
});
