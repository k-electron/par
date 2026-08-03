/**
 * The per-guess skill score.
 *
 * ```
 * s_i = 100 × Q(best legal guess, S_i) / Q(actual guess, S_i)
 * ```
 *
 * ## What this function is not allowed to know
 *
 * It takes the history and the guess. **Not the answer**, and not the feedback
 * the guess earned. That is spec §3's "no future information" made structural:
 * a function that cannot be told what happened cannot let what happened change
 * a score, so philosophy position 1 holds by signature rather than by review.
 *
 * The result carries no argmin either. Spec §10: "never reveal the optimal
 * word", and the surest way to keep a secret out of a UI is for the value it
 * would be read from not to exist. The best guess is a number in here and is
 * never named.
 */

import { expectedInformationBits } from '../numeric/information';
import type { Constraints } from '../rules/constraints';
import type { Ruleset } from '../rules/ruleset';
import { isConsistent, type Observation, patternCounts } from '../words/filter';
import type { CompiledLexicon } from '../words/lexicon';
import { buildPatternMatrix, type PatternMatrix } from '../search/matrix';
import type { SearchPolicy } from '../search/policy';
import { createSearcher, type Searcher } from '../search/value';

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
   * Whether the position offered no real choice, so the 100 was unavoidable.
   *
   * Decision 0001: this covers the coin flip — two live candidates where either
   * scores 100 — as well as the single-legal-guess case §10 names. Philosophy
   * position 12's motivating player is the one forced to pick between two words
   * and unlucky; the label is how the results page says the score was not earned
   * and the miss was not a mistake.
   */
  readonly forced: boolean;
  /**
   * Expected bits the guess reveals. Display only, and the reason it is here
   * rather than in the scorer's own arithmetic: it is what the luck stat is
   * measured against.
   */
  readonly expectedBits: number;
}

export interface PositionScorer {
  /**
   * Score `guess` played against the position `history` leads to.
   *
   * Throws when the guess is not in the dictionary, when it is illegal under the
   * ruleset, or when the history leaves no candidate at all — each of which is a
   * caller bug rather than a score.
   */
  scoreGuess(history: readonly Observation[], guess: string): GuessScore;
  /** The candidates a history leaves, as words, for the UI's own stats. */
  candidatesAfter(history: readonly Observation[]): string[];
  /** How many positions the search has solved, for the performance tests. */
  readonly solved: number;
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
      const forced =
        skill === 100 && (candidateCount <= 2 || search.legalCount(constraints) === 1);

      const words = Array.from(candidates, (answer) => lexicon.answerWords[answer]!);

      return {
        skill,
        candidateCount,
        forced,
        expectedBits: expectedInformationBits(patternCounts(guess, words), candidateCount),
      };
    },

    candidatesAfter(history) {
      return Array.from(
        candidateIndices(history),
        (answer) => lexicon.answerWords[answer]!,
      );
    },

    get solved() {
      return searcher?.solved ?? 0;
    },
  };
}
