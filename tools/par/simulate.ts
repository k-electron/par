/**
 * Playing Par by machine, so that PAR and the incentive ordering are measured
 * rather than assumed.
 *
 * Shared by `compute-par.ts` and `incentives.ts`. None of this ships to the
 * browser, and that matters for one reason in particular: **the engine
 * deliberately exposes no "best guess"**. Spec §3 forbids ever revealing the
 * optimal word, and `Searcher` keeps the argmin unreachable so a UI cannot leak
 * what it was never handed. A simulation genuinely does need best play, so it
 * derives one here, at build time, from the public `costOf` — which keeps the
 * invariant intact where it counts.
 *
 * The choice mirrors the spec's own search: rank legal guesses by one-step
 * expected information, take the best few plus the live candidates, and pick
 * the lowest expected total. It reuses the shipped matrix and `costOf` rather
 * than reimplementing `V`, so this is a caller of the engine, not a second copy
 * of it.
 */

import { answers, answersV2, answersV2Weights, guesses as dictionary, starters } from '../../src/data';
import { MAX_GUESSES } from '../../src/engine/config/constants';
import { log2 } from '../../src/engine/numeric/log2';
import type { Constraints } from '../../src/engine/rules/constraints';
import { rulesetFor, type Ruleset } from '../../src/engine/rules/ruleset';
import { scoreGame, type GameScore } from '../../src/engine/score/scoreGame';
import { createPositionScorer } from '../../src/engine/score/scoreGuess';
import { buildPatternMatrix } from '../../src/engine/search/matrix';
import { validatedPolicy } from '../../src/engine/search/policy';
import { createSearcher } from '../../src/engine/search/value';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { compileLexicon, type CompiledLexicon } from '../../src/engine/words/lexicon';
import { PATTERN_COUNT, WIN_PATTERN, computePattern } from '../../src/engine/words/pattern';

export const lexicon: CompiledLexicon = compileLexicon({
  guesses: [...dictionary],
  answers: [...answers],
});

export const v2Lexicon: CompiledLexicon = compileLexicon({
  guesses: [...dictionary],
  answers: [...answersV2],
  answerWeights: answersV2Weights,
});

export const lists = { answers: [...answers], starters: [...starters] };
export const listsV2 = { answers: [...answers], starters: [...starters], answersV2: [...answersV2] };

/**
 * How many guesses of each kind to weigh at a node.
 *
 * Bounded for the same reason the shipped search is bounded: every guess
 * considered costs a full `V` recursion, and weighing all several hundred live
 * candidates at turn two takes minutes per game rather than milliseconds.
 */
const PROBES_CONSIDERED = 6;
const CANDIDATES_CONSIDERED = 6;

/** How a simulated player picks each guess after the opener. */
export type Continuation = 'strong' | 'bookmark';

export interface PlayOptions {
  readonly opener: string;
  readonly answer: string;
  readonly ruleset: Ruleset;
  /**
   * `strong` plays the lowest expected total available, which is what PAR is
   * anchored to. `bookmark` throws the second guess away on a memorised word,
   * which is the habit the starter bonus exists to tax.
   */
  readonly continuation: Continuation;
  readonly bookmark?: string;
  readonly activeLexicon?: CompiledLexicon | undefined;
}

export interface PlayResult {
  readonly guesses: readonly string[];
  readonly solved: boolean;
  readonly guessesUsed: number;
}

export function play({
  opener,
  answer,
  ruleset,
  continuation,
  bookmark,
  activeLexicon = lexicon,
}: PlayOptions): PlayResult {
  const played: string[] = [];
  let candidates = Int32Array.from({ length: activeLexicon.answerCount }, (_, index) => index);
  let constraints = ruleset.initialConstraints;

  // Built once, after the opener has cut the field to a few hundred, and reused
  // for the rest of the game because the candidate set only ever shrinks. This
  // is the whole performance story: rebuilding it per node means recomputing
  // 12,972 × |S| patterns every move.
  let table: GameTable | null = null;

  for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
    let guess: string;

    if (turn === 0) {
      guess = opener;
    } else if (
      continuation === 'bookmark' &&
      turn === 1 &&
      bookmark !== undefined &&
      ruleset.isLegal(constraints, bookmark)
    ) {
      // Only the move straight after the opener is thrown away. A player who
      // ignored every clue all game would be a strawman, not the habit in
      // question.
      guess = bookmark;
    } else {
      table ??= createGameTable(candidates, ruleset, activeLexicon);
      guess = strongestGuess(table, candidates, constraints, ruleset);
    }

    played.push(guess);
    const pattern = computePattern(guess, answer);

    if (pattern === WIN_PATTERN) {
      return { guesses: played, solved: true, guessesUsed: played.length };
    }

    constraints = ruleset.accumulate(constraints, { guess, pattern });
    candidates = candidates.filter(
      (index) => computePattern(guess, activeLexicon.answerWords[index]!) === pattern,
    );
  }

  return { guesses: played, solved: false, guessesUsed: MAX_GUESSES };
}

interface GameTable {
  readonly matrix: ReturnType<typeof buildPatternMatrix>;
  readonly searcher: ReturnType<typeof createSearcher>;
  readonly lexicon: CompiledLexicon;
}

function createGameTable(
  candidates: Int32Array,
  ruleset: Ruleset,
  activeLex: CompiledLexicon = lexicon,
): GameTable {
  const matrix = buildPatternMatrix(activeLex, candidates);
  return {
    matrix,
    searcher: createSearcher({ lexicon: activeLex, ruleset, policy: validatedPolicy }, matrix),
    lexicon: activeLex,
  };
}

/**
 * The guess with the lowest expected total from here.
 *
 * Ties break by dictionary index, the same total order the engine uses, so
 * rerunning this script reproduces the same games.
 */
function strongestGuess(
  table: GameTable,
  candidates: Int32Array,
  constraints: Constraints,
  ruleset: Ruleset,
): string {
  const lex = table.lexicon;
  if (candidates.length === 1) {
    return lex.answerWords[candidates[0]!]!;
  }

  const ranked = rankByInformation(table.matrix, candidates, constraints, ruleset, lex);
  const candidateGuesses = new Set(
    Array.from(candidates, (answer) => lex.answerToGuess[answer]!),
  );

  const considered = new Set<number>();
  let probes = 0;
  let candidatesTaken = 0;
  for (const guessIndex of ranked) {
    const isCandidate = candidateGuesses.has(guessIndex);
    if (isCandidate && candidatesTaken < CANDIDATES_CONSIDERED) {
      considered.add(guessIndex);
      candidatesTaken += 1;
    } else if (!isCandidate && probes < PROBES_CONSIDERED) {
      considered.add(guessIndex);
      probes += 1;
    }
    if (probes >= PROBES_CONSIDERED && candidatesTaken >= CANDIDATES_CONSIDERED) break;
  }

  let best = Number.POSITIVE_INFINITY;
  let bestIndex = -1;
  for (const guessIndex of [...considered].sort((a, b) => a - b)) {
    const cost = table.searcher.costOf(guessIndex, candidates, constraints);
    if (cost < best) {
      best = cost;
      bestIndex = guessIndex;
    }
  }

  return lex.guessWords[bestIndex]!;
}

/** Legal guesses ordered by one-step expected information, best first. */
function rankByInformation(
  matrix: ReturnType<typeof buildPatternMatrix>,
  candidates: Int32Array,
  constraints: Constraints,
  ruleset: Ruleset,
  lex: CompiledLexicon = lexicon,
): number[] {
  const counts = new Int32Array(PATTERN_COUNT);
  const touched = new Int32Array(PATTERN_COUNT);
  const columns = Int32Array.from(candidates, (answer) => matrix.columnOf[answer]!);
  const restricted = ruleset.restrictsLegalGuesses;

  const keys = new Float64Array(lex.guessCount);
  const order: number[] = [];

  for (let guessIndex = 0; guessIndex < lex.guessCount; guessIndex += 1) {
    if (restricted && !ruleset.isLegal(constraints, lex.guessWords[guessIndex]!)) continue;

    const row = guessIndex * matrix.width;
    let distinct = 0;
    for (let position = 0; position < columns.length; position += 1) {
      const col = columns[position]!;
      const pattern = matrix.patterns[row + col]!;
      if (counts[pattern] === 0) {
        touched[distinct] = pattern;
        distinct += 1;
      }
      counts[pattern]! += matrix.weights[col]!;
    }

    // Σ n log2 n falls as expected information rises, so a lower key ranks
    // better — the same key the engine's own selection uses. Routed through the
    // engine's deterministic log2 rather than Math.log2, so regenerating PAR on
    // another machine cannot quietly produce a different constant.
    let key = 0;
    for (let index = 0; index < distinct; index += 1) {
      const pattern = touched[index]!;
      const count = counts[pattern]!;
      if (count > 1) key += count * log2(count);
      counts[pattern] = 0;
    }

    keys[guessIndex] = key;
    order.push(guessIndex);
  }

  order.sort((a, b) => keys[a]! - keys[b]! || a - b);
  return order;
}

/** Score a played game the way the app would. */
export function scorePlayed(
  result: PlayResult,
  answer: string,
  ruleset: Ruleset,
  tookHouseStarter: boolean,
): GameScore {
  const scorer = createPositionScorer({ lexicon, ruleset, policy: validatedPolicy });
  return scoreGame({ guesses: result.guesses, answer, tookHouseStarter }, scorer);
}

/** The puzzles for a run of consecutive days. */
export function puzzlesFor(days: number, from = 0, puzzleLists = lists) {
  return Array.from({ length: days }, (_, offset) => drawPuzzle(from + offset, puzzleLists));
}

export { rulesetFor };
