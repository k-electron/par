/**
 * Helpers for building the positions the scorer is asked about.
 *
 * A position is a history of (guess, pattern) observations, so a test that wants
 * a particular candidate set says which answer was hidden and which guesses were
 * played, and lets the feedback rules produce the history. Nothing here reaches
 * into the scorer; these are the same primitives the game layer will use.
 */

import { filterByHistory, type Observation } from '../../src/engine/words/filter';
import { computePattern } from '../../src/engine/words/pattern';
import type { Lexicon } from '../../src/engine/words/lexicon';

/** The history `guesses` produces against a hidden `answer`. */
export function observationsFor(
  answer: string,
  guesses: readonly string[],
): Observation[] {
  return guesses.map((guess) => ({ guess, pattern: computePattern(guess, answer) }));
}

/** The candidate set a history leaves, drawn from the answer list. */
export function candidatesAfter(
  lexicon: Lexicon,
  history: readonly Observation[],
): string[] {
  return filterByHistory(lexicon.answers, history);
}

/**
 * A fixed permutation of `items`, for asserting that reordering an input cannot
 * move a score.
 *
 * Deliberately not random: spec §5 rules out `Math.random` anywhere near the
 * scorer, and a shuffle that differs between runs would turn a determinism test
 * into a flaky one. Taking the odd positions backwards and then the even ones is
 * a permutation for every length, and moves every element for lengths above one.
 */
export function permuted<T>(items: readonly T[]): T[] {
  const odd = items.filter((_, index) => index % 2 === 1).reverse();
  const even = items.filter((_, index) => index % 2 === 0);
  return [...odd, ...even];
}
