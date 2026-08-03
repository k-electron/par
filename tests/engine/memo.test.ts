import { describe, expect, it } from 'vitest';

import {
  candidateSetKey,
  createValueMemo,
  positionKey,
} from '../../src/engine/search/memo';
import { constraintKey, NO_CONSTRAINTS } from '../../src/engine/rules/constraints';
import { hardRuleset } from '../../src/engine/rules/ruleset';
import { computePattern } from '../../src/engine/words/pattern';

describe('the candidate set key', () => {
  it('separates every set the answer list can produce', () => {
    const seen = new Map<string, string>();

    // Every subset of eight indices, which is enough to catch an encoding that
    // confused a set with a different one of the same size or a prefix of it.
    for (let mask = 1; mask < 256; mask += 1) {
      const members: number[] = [];
      for (let index = 0; index < 8; index += 1) {
        if ((mask & (1 << index)) !== 0) {
          members.push(index * 37);
        }
      }
      const key = candidateSetKey(members, members.length);
      const previous = seen.get(key);

      expect(previous ?? members.join(',')).toBe(members.join(','));
      seen.set(key, members.join(','));
    }

    expect(seen.size).toBe(255);
  });

  it('keys the same set the same way every time', () => {
    expect(candidateSetKey([4, 17, 300], 3)).toBe(candidateSetKey([4, 17, 300], 3));
  });

  it('reads only the count it was given', () => {
    expect(candidateSetKey([4, 17, 300], 2)).toBe(candidateSetKey([4, 17], 2));
  });

  it('handles a set larger than one chunk of the builder', () => {
    const big = Array.from({ length: 2999 }, (_, index) => index);

    expect(candidateSetKey(big, big.length)).toHaveLength(2999);
    expect(candidateSetKey(big, big.length)).not.toBe(
      candidateSetKey(big.slice(0, 2998), 2998),
    );
  });
});

describe('the position key', () => {
  it('degenerates to the candidate set in normal mode', () => {
    // Normal mode accumulates no constraints, so the key carries nothing but the
    // set and the memo behaves as if it had been keyed on the set alone.
    expect(positionKey(constraintKey(NO_CONSTRAINTS), 'abc')).toBe('0:abc');
  });

  it('separates two paths that reached the same set under different constraints', () => {
    // The reason the set alone will not do. In hard mode these two positions
    // have different legal sets and therefore different values.
    const viaBatch = hardRuleset.accumulate(NO_CONSTRAINTS, {
      guess: 'batch',
      pattern: computePattern('batch', 'catch'),
    });
    const viaHatch = hardRuleset.accumulate(NO_CONSTRAINTS, {
      guess: 'crane',
      pattern: computePattern('crane', 'catch'),
    });

    expect(constraintKey(viaBatch)).not.toBe(constraintKey(viaHatch));
    expect(positionKey(constraintKey(viaBatch), 'set')).not.toBe(
      positionKey(constraintKey(viaHatch), 'set'),
    );
  });

  it('is injective whatever either half happens to contain', () => {
    // A candidate set encodes one code unit per answer index, so a real set can
    // contain any punctuation an encoding might have wanted to use as a
    // separator. Joining behind the length of the first half means no pair of
    // parts can be rearranged into another pair, whatever they hold.
    const parts: readonly [string, string][] = [
      ['', ''],
      ['', ':'],
      [':', ''],
      ['a', 'bc'],
      ['ab', 'c'],
      ['abc', ''],
      ['', 'abc'],
      ['1:2', '3'],
      ['1', ':23'],
      ['ab.../a1', candidateSetKey([124], 1)],
      ['ab.../a1' + candidateSetKey([124], 1), ''],
    ];

    const keys = parts.map(([constraints, candidates]) =>
      positionKey(constraints, candidates),
    );

    expect(new Set(keys).size).toBe(parts.length);
  });
});

describe('the memo table', () => {
  it('returns what it was told', () => {
    const memo = createValueMemo();

    expect(memo.get('a')).toBeUndefined();
    expect(memo.finish('a', 2.5)).toBe(2.5);
    expect(memo.get('a')).toBe(2.5);
    expect(memo.solved).toBe(1);
  });

  it('reports a position that is still being computed', () => {
    // Spec §3's cycle guard. Excluding non-splitting guesses should already make
    // this unreachable, so its job is to turn a future mistake into a bounded
    // wrong answer rather than a hung tab.
    const memo = createValueMemo();

    memo.begin('a');
    expect(memo.isInProgress('a')).toBe(true);
    expect(memo.get('a')).toBeUndefined();

    memo.finish('a', 1.5);
    expect(memo.isInProgress('a')).toBe(false);
  });
});
