import { describe, expect, it } from 'vitest';

import {
  bruteForcePolicy,
  validatedPolicy,
  widePolicy,
} from '../../src/engine/search/policy';

/**
 * Spec §3's table, band by band. Written out as data here rather than derived,
 * because the whole point is that the numbers match a table someone validated by
 * simulation — a test that recomputed them from the implementation would agree
 * with any ladder at all.
 */
describe('the validated search budget', () => {
  const EXPECTED = [
    { candidateCount: 3000, probes: 2, candidates: 1 },
    { candidateCount: 201, probes: 2, candidates: 1 },
    { candidateCount: 200, probes: 3, candidates: 2 },
    { candidateCount: 61, probes: 3, candidates: 2 },
    { candidateCount: 60, probes: 6, candidates: 4 },
    { candidateCount: 16, probes: 6, candidates: 4 },
    { candidateCount: 15, probes: 12, candidates: 12 },
    { candidateCount: 3, probes: 12, candidates: 12 },
    { candidateCount: 1, probes: 12, candidates: 12 },
  ] as const;

  it.each(EXPECTED)(
    'searches $probes probes and $candidates candidates at |S| = $candidateCount',
    ({ candidateCount, probes, candidates }) => {
      expect(validatedPolicy.budgetFor(candidateCount)).toEqual({ probes, candidates });
    },
  );

  it('budgets probes and candidates separately', () => {
    // Decision 0001: the plan collapsed the spec's two columns into a single
    // ladder of 2/3/6/12, which would give two to three times the intended
    // candidate branching at exactly the nodes where cost concentrates. The
    // candidate column is 1/2/4/12.
    const candidateLadder = [3000, 200, 60, 15].map(
      (count) => validatedPolicy.budgetFor(count).candidates,
    );
    const probeLadder = [3000, 200, 60, 15].map(
      (count) => validatedPolicy.budgetFor(count).probes,
    );

    expect(candidateLadder).toEqual([1, 2, 4, 12]);
    expect(probeLadder).toEqual([2, 3, 6, 12]);
    expect(candidateLadder).not.toEqual(probeLadder);
  });

  it('always searches at least one candidate, so a value is always reachable', () => {
    // A candidate guess can win outright, so it always splits a set of two or
    // more. Keeping one in the budget at every band is what guarantees the
    // minimum over Q is finite even though non-splitting guesses are excluded.
    for (let count = 1; count <= 400; count += 1) {
      expect(validatedPolicy.budgetFor(count).candidates).toBeGreaterThanOrEqual(1);
      expect(widePolicy.budgetFor(count).candidates).toBeGreaterThanOrEqual(1);
    }
  });

  it('rejects a candidate count that cannot occur', () => {
    expect(() => validatedPolicy.budgetFor(0)).toThrow(RangeError);
    expect(() => validatedPolicy.budgetFor(-1)).toThrow(RangeError);
  });
});

describe('the reference and wide policies', () => {
  it('brute force searches everything at every size', () => {
    for (const count of [1, 15, 60, 200, 3000]) {
      expect(bruteForcePolicy.budgetFor(count)).toEqual({
        probes: Number.POSITIVE_INFINITY,
        candidates: Number.POSITIVE_INFINITY,
      });
    }
  });

  it('the wide policy is wider than the validated one at every band', () => {
    for (const count of [3000, 201, 200, 61, 60, 16, 15, 3, 1]) {
      const validated = validatedPolicy.budgetFor(count);
      const wide = widePolicy.budgetFor(count);

      expect(wide.probes).toBeGreaterThan(validated.probes);
      expect(wide.candidates).toBeGreaterThan(validated.candidates);
    }
  });

  it('the wide policy is exhaustive once the field is down to fifteen', () => {
    // Spec §3 asks for scores that are exact where precision is visible, which
    // is small candidate sets and endgames. Below the last band the wide policy
    // and brute force are the same search.
    expect(widePolicy.budgetFor(15)).toEqual(bruteForcePolicy.budgetFor(15));
  });

  it('names itself, so a disagreement can say which policy produced it', () => {
    expect(validatedPolicy.name).toBe('validated');
    expect(widePolicy.name).toBe('wide');
    expect(bruteForcePolicy.name).toBe('brute force');
  });
});
