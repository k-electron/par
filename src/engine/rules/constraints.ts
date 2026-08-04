/**
 * Accumulated hard-mode constraints.
 *
 * Spec §6: "revealed greens must be reused in position, and revealed letters
 * reused at least as many times as hinted" — today's Wordle rule. There is no
 * upper bound: a grey letter may be played again.
 *
 * Two properties of this type are load-bearing.
 *
 * **It is canonical.** Required letters are held ascending by letter code, so
 * equal constraints always produce an equal `constraintKey` and unequal ones
 * never collide. The search memo is keyed on the candidate set *and* this key
 * (spec §3: hypothetical continuations accumulate the constraints they would
 * have generated), because two paths reaching the same candidate set can carry
 * different constraints. Keys are exact strings rather than hashes, so two
 * different constraint sets cannot silently share an entry and corrupt a score.
 *
 * **Accumulating only ever narrows.** Greens are added and never removed, and
 * minimum counts only rise. The search relies on that to build a child node's
 * legal set by filtering its parent's rather than rescanning the dictionary.
 */

import { ALPHABET_SIZE, CODE_A, WORD_LENGTH, encodeWord } from '../words/letters';
import { PATTERN_PLACE_VALUES, Tile } from '../words/pattern';
import type { Observation } from '../words/filter';

export interface Constraints {
  /** Letter code fixed at each position by a revealed green, or -1 if free. */
  readonly greens: Int8Array;
  /** Letters with a minimum count, ascending by letter code. At most five. */
  readonly requiredLetters: Uint8Array;
  /** The minimum number of times the letter at the same index must appear. */
  readonly requiredCounts: Uint8Array;
}

function freeGreens(): Int8Array {
  return new Int8Array(WORD_LENGTH).fill(-1);
}

/** Nothing revealed yet: every guess is legal. */
export const NO_CONSTRAINTS: Constraints = {
  greens: freeGreens(),
  requiredLetters: new Uint8Array(0),
  requiredCounts: new Uint8Array(0),
};

export function isUnconstrained(constraints: Constraints): boolean {
  if (constraints.requiredLetters.length > 0) {
    return false;
  }
  for (let position = 0; position < WORD_LENGTH; position += 1) {
    if (constraints.greens[position]! >= 0) {
      return false;
    }
  }
  return true;
}

/**
 * The constraints implied by `prior` together with one more observation.
 *
 * The letter minimum a single observation hints is its count of green plus
 * yellow tiles for that letter; across observations the minimum is the largest
 * hint seen, not their sum.
 */
export function accumulateConstraints(
  prior: Constraints,
  observation: Observation,
): Constraints {
  const guessCodes = encodeWord(observation.guess);
  const greens = Int8Array.from(prior.greens);

  const hinted = new Uint8Array(ALPHABET_SIZE);
  let rest = observation.pattern;

  for (let position = 0; position < WORD_LENGTH; position += 1) {
    const place = PATTERN_PLACE_VALUES[position]!;
    const digit = Math.floor(rest / place);
    rest -= digit * place;

    const letter = guessCodes[position]!;
    if (digit === Tile.Correct) {
      greens[position] = letter;
    }
    if (digit === Tile.Correct || digit === Tile.Present) {
      hinted[letter] = hinted[letter]! + 1;
    }
  }

  const minimums = new Uint8Array(ALPHABET_SIZE);
  for (let index = 0; index < prior.requiredLetters.length; index += 1) {
    minimums[prior.requiredLetters[index]!] = prior.requiredCounts[index]!;
  }
  for (let letter = 0; letter < ALPHABET_SIZE; letter += 1) {
    if (hinted[letter]! > minimums[letter]!) {
      minimums[letter] = hinted[letter]!;
    }
  }

  const letters: number[] = [];
  const counts: number[] = [];
  for (let letter = 0; letter < ALPHABET_SIZE; letter += 1) {
    if (minimums[letter]! > 0) {
      letters.push(letter);
      counts.push(minimums[letter]!);
    }
  }

  return {
    greens,
    requiredLetters: Uint8Array.from(letters),
    requiredCounts: Uint8Array.from(counts),
  };
}

/**
 * Whether a word encoded at `offset` satisfies the constraints.
 *
 * Called once per dictionary word per node in hard mode, so it reads letter
 * codes out of the compiled lexicon rather than a string, and counts the at
 * most five required letters against the five positions directly rather than
 * building a 26-slot table.
 */
export function encodedSatisfies(
  constraints: Constraints,
  letters: Uint8Array,
  offset: number,
): boolean {
  for (let position = 0; position < WORD_LENGTH; position += 1) {
    const required = constraints.greens[position]!;
    if (required >= 0 && letters[offset + position] !== required) {
      return false;
    }
  }

  const { requiredLetters, requiredCounts } = constraints;
  for (let index = 0; index < requiredLetters.length; index += 1) {
    const letter = requiredLetters[index]!;
    let seen = 0;
    for (let position = 0; position < WORD_LENGTH; position += 1) {
      if (letters[offset + position] === letter) {
        seen += 1;
      }
    }
    if (seen < requiredCounts[index]!) {
      return false;
    }
  }

  return true;
}

/** Whether `word` satisfies the constraints. */
export function satisfiesConstraints(constraints: Constraints, word: string): boolean {
  return encodedSatisfies(constraints, encodeWord(word), 0);
}

/**
 * A canonical, exact key for these constraints.
 *
 * Empty exactly when nothing is constrained, which is what makes the normal
 * mode memo key degenerate to the candidate set alone.
 */
export function constraintKey(constraints: Constraints): string {
  if (isUnconstrained(constraints)) {
    return '';
  }

  let key = '';
  for (let position = 0; position < WORD_LENGTH; position += 1) {
    const letter = constraints.greens[position]!;
    key += letter < 0 ? '.' : String.fromCharCode(CODE_A + letter);
  }
  key += '/';
  for (let index = 0; index < constraints.requiredLetters.length; index += 1) {
    key += String.fromCharCode(CODE_A + constraints.requiredLetters[index]!);
    key += String(constraints.requiredCounts[index]!);
  }
  return key;
}
