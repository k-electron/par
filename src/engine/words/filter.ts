/**
 * Candidate-set filtering — turning feedback back into "which answers are still
 * possible".
 *
 * Spec §3: `S_i` is the set of **answer-list** words consistent with all
 * feedback before guess *i*. The answer list, not the guess dictionary:
 * docs/philosophy.md ("Why the benchmark uses the answer list") explains that
 * treating obscure non-answer words as live possibilities would punish a player
 * for correctly sensing the answer will be a common word. Nothing here ever
 * receives the guess dictionary.
 *
 * A word is consistent with an observation exactly when replaying the guess
 * against it reproduces the observed pattern, so there are no separate
 * green/yellow/grey rules to get wrong — and duplicate handling is inherited
 * from `computePattern` rather than reimplemented.
 */

import { PATTERN_COUNT, computePattern } from './pattern';

/** A guess already played, and the feedback it returned. */
export interface Observation {
  readonly guess: string;
  /** The pattern in 0..242 — see `words/pattern.ts` for the encoding. */
  readonly pattern: number;
}

/** Whether `candidate` could still be the answer given one observation. */
export function isConsistent(candidate: string, observation: Observation): boolean {
  return computePattern(observation.guess, candidate) === observation.pattern;
}

/** The candidates that would have produced `pattern` from `guess`. */
export function filterCandidates(
  candidates: readonly string[],
  guess: string,
  pattern: number,
): string[] {
  return candidates.filter((candidate) => computePattern(guess, candidate) === pattern);
}

/**
 * The candidates still consistent with every observation, oldest first.
 *
 * Applied in order so the cheapest reduction happens first; the result is
 * order-independent because consistency is a conjunction of independent tests.
 */
export function filterByHistory(
  candidates: readonly string[],
  history: readonly Observation[],
): string[] {
  let live: readonly string[] = candidates;
  for (const observation of history) {
    live = filterCandidates(live, observation.guess, observation.pattern);
  }
  return [...live];
}

/**
 * How many of `candidates` fall into each pattern when `guess` is played, as a
 * dense 243-slot table.
 *
 * Dense rather than a `Map` on purpose: a table is iterated in pattern order,
 * which is a fixed order on every machine, whereas a `Map` would be iterated in
 * insertion order. Spec §5 rules out depending on that.
 */
export function patternCounts(guess: string, candidates: readonly string[]): Int32Array {
  const counts = new Int32Array(PATTERN_COUNT);
  for (const candidate of candidates) {
    const pattern = computePattern(guess, candidate);
    counts[pattern] = counts[pattern]! + 1;
  }
  return counts;
}
