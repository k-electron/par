import { describe, expect, it } from 'vitest';

import { selectBest } from '../../src/engine/search/select';
import { permuted } from '../support/positions';

/**
 * Selection is the one place in the search where a tie can move a score, because
 * it decides which guesses are evaluated at all. Spec §5 therefore needs the
 * order to be total, and these tests are about the tie-break rather than about
 * the sorting.
 */

function select(
  ids: readonly number[],
  keys: Record<number, number>,
  limit: number,
): number[] {
  const from = Int32Array.from(ids);
  const keyTable = new Float64Array(Math.max(...ids) + 1);
  for (const [id, key] of Object.entries(keys)) {
    keyTable[Number(id)] = key;
  }
  const into = new Int32Array(ids.length);
  const written = selectBest(from, from.length, keyTable, limit, into);
  return [...into.subarray(0, written)];
}

describe('selecting the best-ranked guesses', () => {
  it('takes the lowest keys, best first', () => {
    expect(select([0, 1, 2, 3], { 0: 9, 1: 1, 2: 5, 3: 3 }, 2)).toEqual([1, 3]);
    expect(select([0, 1, 2, 3], { 0: 9, 1: 1, 2: 5, 3: 3 }, 4)).toEqual([1, 3, 2, 0]);
  });

  it('breaks a tie by the lower guess index', () => {
    expect(select([5, 2, 9, 7], { 5: 1, 2: 1, 9: 1, 7: 1 }, 3)).toEqual([2, 5, 7]);
  });

  it('gives the same answer whatever order the guesses were offered in', () => {
    // The real hazard: two engines that enumerated the legal set differently
    // would search different guesses and could report different scores.
    const ids = [11, 4, 7, 2, 19, 5, 13, 8];
    const keys = { 11: 3, 4: 1, 7: 3, 2: 8, 19: 1, 5: 6, 13: 3, 8: 0 };

    const forwards = select(ids, keys, 4);
    expect(select(permuted(ids), keys, 4)).toEqual(forwards);
    expect(select([...ids].reverse(), keys, 4)).toEqual(forwards);
    expect(forwards).toEqual([8, 4, 19, 7]);
  });

  it('returns everything in ranked order when the limit is unbounded', () => {
    expect(
      select([3, 1, 2], { 1: 2, 2: 2, 3: 1 }, Number.POSITIVE_INFINITY),
    ).toEqual([3, 1, 2]);
  });

  it('returns everything when the limit exceeds what is on offer', () => {
    expect(select([3, 1], { 1: 5, 3: 1 }, 10)).toEqual([3, 1]);
  });

  it('returns nothing when the budget is nothing', () => {
    expect(select([3, 1], { 1: 5, 3: 1 }, 0)).toEqual([]);
    expect(select([3, 1], { 1: 5, 3: 1 }, -1)).toEqual([]);
  });

  it('agrees with a full sort for every budget, over a hand-made ranking', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Deliberately full of ties, since ties are the only interesting case.
    const keys = { 0: 2, 1: 1, 2: 2, 3: 1, 4: 3, 5: 1, 6: 2, 7: 3, 8: 0, 9: 3 };
    const fully = select(ids, keys, Number.POSITIVE_INFINITY);

    for (let limit = 0; limit <= ids.length; limit += 1) {
      expect(select(ids, keys, limit), `limit ${limit}`).toEqual(fully.slice(0, limit));
    }
  });

  it('does not read beyond the count it was given', () => {
    const from = Int32Array.from([1, 2, 999]);
    const keys = new Float64Array(1000);
    keys[1] = 5;
    keys[2] = 4;
    keys[999] = 0;
    const into = new Int32Array(3);

    expect(selectBest(from, 2, keys, 3, into)).toBe(2);
    expect([...into.subarray(0, 2)]).toEqual([2, 1]);
  });

  it('writes no more than the buffer it was handed', () => {
    const from = Int32Array.from([1, 2, 3, 4]);
    const keys = new Float64Array(5);
    const into = new Int32Array(2);

    expect(selectBest(from, 4, keys, Number.POSITIVE_INFINITY, into)).toBe(2);
    expect([...into]).toEqual([1, 2]);
  });
});
