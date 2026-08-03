/**
 * Feedback patterns — the green/yellow/grey result of a guess, as one integer.
 *
 * A pattern is five base-three digits packed into 0..242, with **position 0 as
 * the most significant digit**, so the digits read in the same order as the
 * tiles. That choice is arbitrary but it has to be pinned down: patterns are
 * memo keys, matrix entries and (from increment 9) share-link content, so the
 * encoding is part of the scorer's contract and cannot drift. `WIN_PATTERN` is
 * therefore 242, all five digits at 2.
 *
 * Duplicate handling is standard Wordle: greens are assigned first and consume
 * an occurrence of their letter, then each remaining position claims a yellow
 * only if an unconsumed occurrence is left. Spec §10 fixes six cases that this
 * must reproduce exactly; tests/engine/pattern.test.ts checks all six.
 */

import { ALPHABET_SIZE, WORD_LENGTH, addLetterCounts, encodeWord } from './letters';

/** One tile of feedback. */
export const Tile = {
  /** Grey: the letter is not left in the answer. */
  Absent: 0,
  /** Yellow: the letter is in the answer, elsewhere. */
  Present: 1,
  /** Green: the letter is in the answer, here. */
  Correct: 2,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];

/** Base-three place value of each tile position, most significant first. */
export const PATTERN_PLACE_VALUES: readonly number[] = [81, 27, 9, 3, 1];

/** How many distinct patterns exist: 3 ** 5. */
export const PATTERN_COUNT = 243;

/** The all-green pattern, which ends the game. */
export const WIN_PATTERN = 242;

export function isWinPattern(pattern: number): boolean {
  return pattern === WIN_PATTERN;
}

/**
 * The feedback `guess` earns against `answer`.
 *
 * This is the readable reference implementation. The search reads patterns out
 * of a precomputed matrix built by a faster routine over encoded letters;
 * tests/engine/matrix.test.ts asserts the two agree, so this stays the
 * definition of correct behaviour.
 */
export function computePattern(guess: string, answer: string): number {
  const guessCodes = encodeWord(guess);
  const answerCodes = encodeWord(answer);

  const remaining = new Uint8Array(ALPHABET_SIZE);
  addLetterCounts(answer, remaining);

  let pattern = 0;
  let greenMask = 0;

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (guessCodes[index] === answerCodes[index]) {
      pattern += 2 * PATTERN_PLACE_VALUES[index]!;
      greenMask |= 1 << index;
      const letter = guessCodes[index]!;
      remaining[letter] = remaining[letter]! - 1;
    }
  }

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if ((greenMask & (1 << index)) !== 0) {
      continue;
    }
    const letter = guessCodes[index]!;
    if (remaining[letter]! > 0) {
      pattern += PATTERN_PLACE_VALUES[index]!;
      remaining[letter] = remaining[letter]! - 1;
    }
  }

  return pattern;
}

/** The five tiles a pattern stands for, leftmost first. */
export function tilesFromPattern(pattern: number): Tile[] {
  if (!Number.isInteger(pattern) || pattern < 0 || pattern >= PATTERN_COUNT) {
    throw new RangeError(`Not a pattern in 0..${PATTERN_COUNT - 1}: ${pattern}`);
  }
  const tiles: Tile[] = [];
  let rest = pattern;
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    const place = PATTERN_PLACE_VALUES[index]!;
    const digit = Math.floor(rest / place);
    rest -= digit * place;
    tiles.push(digit as Tile);
  }
  return tiles;
}

/** The pattern five tiles stand for, leftmost first. */
export function patternFromTiles(tiles: readonly Tile[]): number {
  if (tiles.length !== WORD_LENGTH) {
    throw new RangeError(`A pattern has ${WORD_LENGTH} tiles, not ${tiles.length}.`);
  }
  let pattern = 0;
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    pattern += tiles[index]! * PATTERN_PLACE_VALUES[index]!;
  }
  return pattern;
}
