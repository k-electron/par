/**
 * The Ruleset port — "what is legal from here", and nothing else.
 *
 * Spec §3 and docs/philosophy.md position 12: hard mode changes only the legal
 * set, never the formula. The player's guess and the benchmark it is measured
 * against are handed the same `Ruleset` instance, so "same formula, different
 * legal set" is structural rather than a rule anyone has to remember, and a
 * forced move therefore scores 100 on its own.
 *
 * `narrow` exists because spec §3 requires the legal set to be recomputed
 * *inside* the recursion: "when evaluating a bucket, the legal set for deeper
 * nodes reflects the feedback that produced that bucket, not just the
 * constraints known at the real position." It takes the whole candidate array
 * rather than one word so the loop over the dictionary lives inside one
 * implementation. Ports resolve once per scoring run and are then closed over,
 * so nothing dispatches through this interface per dictionary word.
 */

import { WORD_LENGTH } from '../words/letters';
import type { Observation } from '../words/filter';
import {
  NO_CONSTRAINTS,
  accumulateConstraints,
  encodedSatisfies,
  satisfiesConstraints,
  type Constraints,
} from './constraints';

export type RulesetMode = 'normal' | 'hard';

export interface Ruleset {
  readonly mode: RulesetMode;
  /**
   * Whether legality can ever depend on accumulated constraints. False for
   * normal mode, which lets the search share one legal set across every node
   * instead of rebuilding an identical one at each.
   */
  readonly restrictsLegalGuesses: boolean;
  /** The constraints in force before any guess has been played. */
  readonly initialConstraints: Constraints;
  /** The constraints in force after one more observation. */
  accumulate(prior: Constraints, observation: Observation): Constraints;
  /** Whether a word may be played under these constraints. */
  isLegal(constraints: Constraints, word: string): boolean;
  /**
   * Copy the legal members of `from` into `into`, returning how many were
   * written. Order is preserved, so a narrowed set keeps the dictionary order
   * the ranking tie-break depends on.
   */
  narrow(
    constraints: Constraints,
    letters: Uint8Array,
    from: Int32Array,
    fromCount: number,
    into: Int32Array,
  ): number;
}

/** Standard rules: every dictionary word stays legal all game. */
export const normalRuleset: Ruleset = {
  mode: 'normal',
  restrictsLegalGuesses: false,
  initialConstraints: NO_CONSTRAINTS,
  accumulate: (prior) => prior,
  isLegal: () => true,
  narrow: (_constraints, _letters, from, fromCount, into) => {
    into.set(from.subarray(0, fromCount));
    return fromCount;
  },
};

/**
 * Hard mode: greens reused in position, revealed letters reused at least as
 * often as hinted.
 */
export const hardRuleset: Ruleset = {
  mode: 'hard',
  restrictsLegalGuesses: true,
  initialConstraints: NO_CONSTRAINTS,
  accumulate: accumulateConstraints,
  isLegal: satisfiesConstraints,
  narrow: (constraints, letters, from, fromCount, into) => {
    let written = 0;
    for (let position = 0; position < fromCount; position += 1) {
      const index = from[position]!;
      if (encodedSatisfies(constraints, letters, WORD_LENGTH * index)) {
        into[written] = index;
        written += 1;
      }
    }
    return written;
  },
};

/** The ruleset for a mode. */
export function rulesetFor(mode: RulesetMode): Ruleset {
  return mode === 'hard' ? hardRuleset : normalRuleset;
}
