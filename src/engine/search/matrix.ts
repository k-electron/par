/**
 * The per-game pattern matrix.
 *
 * Spec §3 points at the optimisation directly: because guess 1 is never scored,
 * every position the scorer ever sees has already been filtered to a few hundred
 * candidates, so "the working set is dictionary × *current candidates*, not
 * dictionary × *all answers* — you never need the full ~30 MB guess×answer
 * pattern matrix, and shouldn't ship it to the client."
 *
 * So the matrix is built once per scoring run against the widest candidate set
 * it will be asked about. Every deeper node is a subset of that set, so ranking
 * the dictionary at a deep node becomes a byte read per candidate instead of a
 * feedback computation — which is where the whole-game budget comes from.
 *
 * Rows are guess-major so that ranking one guess reads contiguous bytes, since
 * ranking is the inner loop.
 *
 * The routine below is the fast path; `words/pattern.ts` holds the readable one.
 * They must agree, and tests/engine/matrix.test.ts asserts that over every pair
 * in a fixture, so the optimisation cannot quietly change the rules.
 */

import { ALPHABET_SIZE, WORD_LENGTH } from '../words/letters';
import type { CompiledLexicon } from '../words/lexicon';
import { PATTERN_PLACE_VALUES } from '../words/pattern';

/** Patterns of every guess against a chosen set of answers, guess-major. */
export interface PatternMatrix {
  /** The answer indices the columns stand for, ascending. */
  readonly answers: Int32Array;
  /** How many columns there are. */
  readonly width: number;
  /** `patterns[guessIndex * width + column]`. */
  readonly patterns: Uint8Array;
  /** Column of an answer index, or -1 if it is not in this matrix. */
  readonly columnOf: Int32Array;
}

/**
 * Build the matrix of every guess against `answers`.
 *
 * `answers` must be ascending, which keeps every candidate set the search
 * derives from it ascending too — the canonical order the memo keys and the
 * accumulation orders depend on.
 */
export function buildPatternMatrix(
  lexicon: CompiledLexicon,
  answers: Int32Array,
): PatternMatrix {
  const width = answers.length;
  if (width === 0) {
    throw new RangeError('A pattern matrix needs at least one candidate.');
  }

  const patterns = new Uint8Array(lexicon.guessCount * width);
  const columnOf = new Int32Array(lexicon.answerCount).fill(-1);

  for (let column = 0; column < width; column += 1) {
    const answer = answers[column]!;
    if (column > 0 && answer <= answers[column - 1]!) {
      throw new RangeError('A pattern matrix needs its answers ascending and distinct.');
    }
    columnOf[answer] = column;
  }

  // Hoisted out of the answer loop: the guess's letters, its distinct letters,
  // and which distinct letter each position draws on. Duplicated letters in a
  // guess share one remaining-count slot, which is what makes duplicate
  // handling come out the same as the reference implementation.
  const guessLetters = new Uint8Array(WORD_LENGTH);
  const distinctLetters = new Uint8Array(WORD_LENGTH);
  const slotOfPosition = new Uint8Array(WORD_LENGTH);
  const remaining = new Uint8Array(WORD_LENGTH);

  for (let guess = 0; guess < lexicon.guessCount; guess += 1) {
    const guessBase = WORD_LENGTH * guess;
    let distinctCount = 0;

    for (let position = 0; position < WORD_LENGTH; position += 1) {
      const letter = lexicon.guessLetters[guessBase + position]!;
      guessLetters[position] = letter;

      let slot = -1;
      for (let seen = 0; seen < distinctCount; seen += 1) {
        if (distinctLetters[seen] === letter) {
          slot = seen;
          break;
        }
      }
      if (slot < 0) {
        slot = distinctCount;
        distinctLetters[distinctCount] = letter;
        distinctCount += 1;
      }
      slotOfPosition[position] = slot;
    }

    const rowBase = guess * width;

    for (let column = 0; column < width; column += 1) {
      const answer = answers[column]!;
      const countsBase = ALPHABET_SIZE * answer;
      const lettersBase = WORD_LENGTH * answer;

      for (let slot = 0; slot < distinctCount; slot += 1) {
        remaining[slot] = lexicon.answerLetterCounts[countsBase + distinctLetters[slot]!]!;
      }

      let pattern = 0;
      let greenMask = 0;

      for (let position = 0; position < WORD_LENGTH; position += 1) {
        if (guessLetters[position] === lexicon.answerLetters[lettersBase + position]) {
          pattern += 2 * PATTERN_PLACE_VALUES[position]!;
          greenMask |= 1 << position;
          const slot = slotOfPosition[position]!;
          remaining[slot] = remaining[slot]! - 1;
        }
      }

      for (let position = 0; position < WORD_LENGTH; position += 1) {
        if ((greenMask & (1 << position)) !== 0) {
          continue;
        }
        const slot = slotOfPosition[position]!;
        if (remaining[slot]! > 0) {
          pattern += PATTERN_PLACE_VALUES[position]!;
          remaining[slot] = remaining[slot]! - 1;
        }
      }

      patterns[rowBase + column] = pattern;
    }
  }

  return { answers, width, patterns, columnOf };
}
