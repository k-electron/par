/**
 * The per-guess skill score.
 *
 * ```
 * s_i = 100 × Q(best legal guess, S_i) / Q(actual guess, S_i)
 * ```
 *
 * Takes only the history and guess without access to the answer or feedback,
 * evaluating decision quality strictly on known information while never revealing optimal words.
 */

import { expectedInformationBits } from '../numeric/information';
import type { Constraints } from '../rules/constraints';
import type { Ruleset } from '../rules/ruleset';
import { isConsistent, type Observation } from '../words/filter';
import type { CompiledLexicon } from '../words/lexicon';
import { buildPatternMatrix, type PatternMatrix } from '../search/matrix';
import type { SearchPolicy } from '../search/policy';
import { createSearcher, type Searcher } from '../search/value';
import { PATTERN_COUNT, computePattern } from '../words/pattern';

export interface ScoringDependencies {
  readonly lexicon: CompiledLexicon;
  readonly ruleset: Ruleset;
  readonly policy: SearchPolicy;
}

export interface GuessScore {
  /** `s_i`, in (0, 100]. */
  readonly skill: number;
  /** `|S_i|`, which is also the aggregation weight's input in spec §3. */
  readonly candidateCount: number;
  /**
   * True when the position offered no real choice (e.g. single candidate, coin flip,
   * or single legal guess) so a 100 was unavoidable.
   */
  readonly forced: boolean;
  /** Expected bits revealed by the guess; baseline for measuring luck. */
  readonly expectedBits: number;
}

export interface PositionScorer {
  /**
   * Score `guess` played against the position `history` leads to.
   *
   * Throws when the guess is not in the dictionary, when it is illegal under the
   * ruleset, or when the history leaves no candidate at all.
   */
  scoreGuess(history: readonly Observation[], guess: string): GuessScore;
  /**
   * Relative standing of `guess` among consistent dictionary words from commonest (0) to bottom (1).
   * Unranked words below the answer cut are placed in the middle of the tail to avoid leaking answer list membership.
   */
  standingOf(history: readonly Observation[], guess: string): number;
  /** The candidates a history leaves, as words, for the UI's own stats. */
  candidatesAfter(history: readonly Observation[]): string[];
  /** The candidates a history leaves, as answer indices. */
  candidateIndicesAfter(history: readonly Observation[]): Int32Array;
  /** The compiled lexicon used by this scorer. */
  readonly lexicon: CompiledLexicon;
  /** How many positions the search has solved, for the performance tests. */
  readonly solved: number;
}

/**
 * Partition candidate weights by feedback pattern for a given guess.
 * Builds an Int32Array of length PATTERN_COUNT and sums candidate weights.
 */
export function partitionCandidateWeights(
  lexicon: CompiledLexicon,
  candidates: ArrayLike<number>,
  guess: string,
): { counts: Int32Array; totalCandidateWeight: number } {
  const counts = new Int32Array(PATTERN_COUNT);
  let totalCandidateWeight = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const answer = candidates[i]!;
    const word = lexicon.answerWords[answer]!;
    const pattern = computePattern(guess, word);
    const w = lexicon.answerWeights[answer]!;
    counts[pattern] = counts[pattern]! + w;
    totalCandidateWeight += w;
  }
  return { counts, totalCandidateWeight };
}

export function createPositionScorer(dependencies: ScoringDependencies): PositionScorer {
  const { lexicon, ruleset, policy } = dependencies;

  let matrix: PatternMatrix | undefined;
  let searcher: Searcher | undefined;

  /**
   * Reuse the pattern matrix while every position asked about is a subset of the
   * one it was built for, which is what a game replayed in order always is: the
   * candidate set only shrinks. A superset forces a rebuild.
   */
  function searcherFor(candidates: Int32Array): Searcher {
    const covered =
      matrix !== undefined &&
      candidates.every((answer) => (matrix?.columnOf[answer] ?? -1) >= 0);

    if (!covered || searcher === undefined) {
      matrix = buildPatternMatrix(lexicon, candidates);
      searcher = createSearcher({ lexicon, ruleset, policy }, matrix);
    }

    return searcher;
  }

  /** The candidates a history leaves, as ascending answer indices. */
  function candidateIndices(history: readonly Observation[]): Int32Array {
    const alive: number[] = [];
    for (let answer = 0; answer < lexicon.answerCount; answer += 1) {
      const word = lexicon.answerWords[answer]!;
      let consistent = true;
      for (const observation of history) {
        if (!isConsistent(word, observation)) {
          consistent = false;
          break;
        }
      }
      if (consistent) {
        alive.push(answer);
      }
    }
    return Int32Array.from(alive);
  }

  function constraintsFrom(history: readonly Observation[]): Constraints {
    let constraints = ruleset.initialConstraints;
    for (const observation of history) {
      constraints = ruleset.accumulate(constraints, observation);
    }
    return constraints;
  }

  return {
    scoreGuess(history, guess) {
      const guessIndex = lexicon.guessIndexOf(guess);
      if (guessIndex < 0) {
        throw new RangeError(`Not a word in the guess dictionary: ${guess}`);
      }

      const candidates = candidateIndices(history);
      if (candidates.length === 0) {
        throw new RangeError(
          'This history rules out every possible answer, so there is no position to score.',
        );
      }

      const constraints = constraintsFrom(history);
      if (!ruleset.isLegal(constraints, guess)) {
        throw new RangeError(`${guess} is not legal in ${ruleset.mode} mode from here.`);
      }

      const search = searcherFor(candidates);
      const best = search.valueOf(candidates, constraints);
      const played = search.costOf(guessIndex, candidates, constraints);

      // A guess that splits nothing hands back the position it started from, so
      // its cost is the wasted turn plus playing the same position properly.
      // Spec §3 calls such a guess infinitely bad *to select*; leaving it at
      // infinity here would score it 0 and contradict §3's own "scores land in
      // (0, 100]".
      const cost = Number.isFinite(played) ? played : 1 + best;

      // Spec §3: if the player's guess somehow evaluates better than the search's
      // best, treat theirs as best. The approximate policies can only ever
      // overestimate the benchmark, so this is where that shows up — as a 100
      // rather than as a score above it.
      const benchmark = cost < best ? cost : best;
      const skill = (100 * benchmark) / cost;

      const candidateCount = candidates.length;
      const isCoinFlip =
        candidateCount === 2 &&
        lexicon.answerWeights[candidates[0]!] === lexicon.answerWeights[candidates[1]!];
      const forced =
        skill === 100 &&
        (candidateCount === 1 || isCoinFlip || search.legalCount(constraints) === 1);

      const { counts, totalCandidateWeight } = partitionCandidateWeights(
        lexicon,
        candidates,
        guess,
      );

      return {
        skill,
        candidateCount,
        forced,
        expectedBits: expectedInformationBits(counts, totalCandidateWeight),
      };
    },

    standingOf(history, guess) {
      const fits = (word: string): boolean => {
        for (const observation of history) {
          if (!isConsistent(word, observation)) {
            return false;
          }
        }
        return true;
      };

      let pool = 0;
      for (const word of lexicon.guessWords) {
        if (fits(word)) {
          pool += 1;
        }
      }
      // The answer always fits its own history, so the pool is never empty and
      // this is a guard against a caller inventing feedback rather than a case.
      if (pool === 0) {
        return 1;
      }

      // Ascending answer indices are the ranked slice in order, because the
      // answer list is the dictionary sorted by frequency and cut.
      const ranked = candidateIndices(history);
      const rank = lexicon.answerIndexOf(guess);

      if (rank >= 0 && fits(guess)) {
        let commoner = 0;
        for (const answer of ranked) {
          if (answer < rank) {
            commoner += 1;
          }
        }
        return commoner / pool;
      }

      // Below the cut, or ruled out entirely. The tail has no order to read, so
      // the middle of it is the most that can be said.
      return fits(guess) ? (ranked.length + (pool - ranked.length) / 2) / pool : 1;
    },

    candidatesAfter(history) {
      return Array.from(
        candidateIndices(history),
        (answer) => lexicon.answerWords[answer]!,
      );
    },

    candidateIndicesAfter(history) {
      return candidateIndices(history);
    },

    lexicon,

    get solved() {
      return searcher?.solved ?? 0;
    },
  };
}
