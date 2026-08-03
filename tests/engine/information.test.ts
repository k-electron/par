import { describe, expect, it } from 'vitest';

import {
  expectedInformationBits,
  luckBits,
  realizedInformationBits,
} from '../../src/engine/numeric/information';
import { log2 } from '../../src/engine/numeric/log2';
import { patternCounts } from '../../src/engine/words/filter';
import { PATTERN_COUNT } from '../../src/engine/words/pattern';
import { FIXTURE_LEXICON } from '../support/lexicons';
import { permuted } from '../support/positions';

function tableOf(sizes: readonly number[]): Int32Array {
  const counts = new Int32Array(PATTERN_COUNT);
  for (let index = 0; index < sizes.length; index += 1) {
    counts[index * 3] = sizes[index]!;
  }
  return counts;
}

describe('expected information', () => {
  it('is one bit for an even two-way split', () => {
    expect(expectedInformationBits(tableOf([1, 1]), 2)).toBe(1);
    expect(expectedInformationBits(tableOf([8, 8]), 16)).toBe(1);
  });

  it('is exactly zero when a guess separates nothing, for any candidate count', () => {
    // Not merely close to zero: every term is non-negative on its own, so this
    // cannot come back as a small negative and be shown to a player as bad luck.
    expect(expectedInformationBits(tableOf([16]), 16)).toBe(0);
    expect(expectedInformationBits(tableOf([300]), 300)).toBe(0);
    expect(expectedInformationBits(tableOf([2999]), 2999)).toBe(0);
  });

  it('is the full log when every candidate lands alone', () => {
    expect(expectedInformationBits(tableOf([1, 1, 1, 1]), 4)).toBe(2);
    expect(expectedInformationBits(tableOf([1, 1, 1, 1, 1, 1, 1, 1]), 8)).toBe(3);
  });

  it('prefers an even split to a lopsided one of the same size', () => {
    expect(expectedInformationBits(tableOf([4, 4]), 8)).toBeGreaterThan(
      expectedInformationBits(tableOf([7, 1]), 8),
    );
  });

  it('never exceeds the logarithm of the candidate count', () => {
    for (const guess of FIXTURE_LEXICON.guesses) {
      const counts = patternCounts(guess, FIXTURE_LEXICON.answers);
      const bits = expectedInformationBits(counts, FIXTURE_LEXICON.answers.length);

      expect(bits).toBeGreaterThanOrEqual(0);
      expect(bits).toBeLessThanOrEqual(log2(FIXTURE_LEXICON.answers.length));
    }
  });

  it('rejects a candidate count that is not a positive integer', () => {
    expect(() => expectedInformationBits(tableOf([1, 1]), 0)).toThrow(RangeError);
    expect(() => expectedInformationBits(tableOf([1, 1]), 2.5)).toThrow(RangeError);
  });
});

describe('realized information', () => {
  it('counts the halvings the feedback actually delivered', () => {
    expect(realizedInformationBits(16, 1)).toBe(4);
    expect(realizedInformationBits(16, 8)).toBe(1);
    expect(realizedInformationBits(16, 16)).toBe(0);
  });

  it('reports exactly one bit for a halving, however odd the counts', () => {
    // Taken as log2 of the ratio rather than a difference of two logarithms, so
    // this lands on 1 exactly instead of a few ULP away from it — and so that a
    // guess which barely narrowed the field does not lose its significant digits
    // to cancellation.
    expect(realizedInformationBits(300, 150)).toBe(1);
    expect(realizedInformationBits(2998, 1499)).toBe(1);
    expect(realizedInformationBits(300, 300)).toBe(0);
  });

  it('rejects a survivor count that could not have happened', () => {
    expect(() => realizedInformationBits(4, 0)).toThrow(RangeError);
    expect(() => realizedInformationBits(4, 5)).toThrow(RangeError);
  });
});

describe('the luck figure', () => {
  it('is zero when the feedback broke exactly as expected', () => {
    expect(luckBits(tableOf([8, 8]), 16, 8)).toBe(0);
  });

  it('is positive when the field narrowed more than expected', () => {
    expect(luckBits(tableOf([15, 1]), 16, 1)).toBeGreaterThan(0);
  });

  it('is negative when it narrowed less', () => {
    expect(luckBits(tableOf([15, 1]), 16, 15)).toBeLessThan(0);
  });

  it('averages to zero over the outcomes, weighted by their chances', () => {
    // Which is what makes it a luck figure rather than a grade: across the whole
    // partition it has no expectation, so it describes what happened and cannot
    // say anything about how well the guess was chosen.
    const sizes = [5, 3, 3, 2, 1];
    const total = 14;
    const counts = tableOf(sizes);

    let expectation = 0;
    for (const size of sizes) {
      expectation += size * luckBits(counts, total, size);
    }

    expect(Math.abs(expectation / total)).toBeLessThan(1e-12);
  });
});

describe('accumulation order', () => {
  it('does not depend on the order the candidates arrived in', () => {
    // The count table is dense and indexed by pattern, so it is summed in
    // pattern order however the candidate list was ordered.
    for (const guess of FIXTURE_LEXICON.guesses) {
      const forwards = patternCounts(guess, FIXTURE_LEXICON.answers);
      const shuffled = patternCounts(guess, permuted(FIXTURE_LEXICON.answers));

      expect([...shuffled]).toEqual([...forwards]);
      expect(expectedInformationBits(shuffled, FIXTURE_LEXICON.answers.length)).toBe(
        expectedInformationBits(forwards, FIXTURE_LEXICON.answers.length),
      );
    }
  });
});
