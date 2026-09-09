/**
 * The generated word lists.
 *
 * This is a leaf module: it exports data and imports nothing but its own
 * generated files. The engine never reaches in here — it receives word lists
 * through the injected `Lexicon` port, which is what lets engine tests run
 * against twenty-word fixtures. The ESLint dependency rule enforces that.
 *
 * Regenerate with `tools/wordlists/build.py`; see docs/wordlists.md.
 */

import { ANSWERS_PACKED } from './answers.generated';
import {
  ANSWERS_V2_PACKED,
  ANSWERS_V2_MAIN_COUNT,
  ANSWERS_V2_VERBS_START_INDEX,
  ANSWERS_V2_VERBS_COUNT,
  ANSWERS_V2_TOTAL_COUNT,
} from './answers_v2.generated';
import { GUESSES_PACKED } from './guesses.generated';
import { STARTERS_PACKED } from './starters.generated';

export { WORD_LIST_VERSION } from './version.generated';
export {
  ANSWERS_V2_MAIN_COUNT,
  ANSWERS_V2_VERBS_START_INDEX,
  ANSWERS_V2_VERBS_COUNT,
  ANSWERS_V2_TOTAL_COUNT,
};

function unpack(packed: string): readonly string[] {
  return Object.freeze(packed.split('\n'));
}

/** Every word a player may type. Collins CSW19 at five letters. */
export const guesses: readonly string[] = unpack(GUESSES_PACKED);

/** The possible answers for v1 (puzzles < 260). Frequency-ranked, a subset of `guesses`. */
export const answers: readonly string[] = unpack(ANSWERS_PACKED);

/** The v2 master candidate answers (puzzles >= 260). 9,570 words with weighted selection. */
export const answersV2: readonly string[] = unpack(ANSWERS_V2_PACKED);

/** Candidate weights for answersV2: 10 for top 2.5k, 4 for next 2.5k, 2 for next 2.5k, 1 for remaining. */
export const answersV2Weights: Uint8Array = (() => {
  const weights = new Uint8Array(ANSWERS_V2_TOTAL_COUNT);
  for (let i = 0; i < 2_500; i += 1) weights[i] = 10;
  for (let i = 2_500; i < 5_000; i += 1) weights[i] = 4;
  for (let i = 5_000; i < 7_500; i += 1) weights[i] = 2;
  for (let i = 7_500; i < ANSWERS_V2_TOTAL_COUNT; i += 1) weights[i] = 1;
  return weights;
})();

/**
 * The house-starter pool for v1 (puzzles < 260). Frequency-ranked, letter-filtered,
 * a subset of `guesses`.
 */
export const starters: readonly string[] = unpack(STARTERS_PACKED);

export const STARTERS_V2_COUNT = 5_000;

/**
 * The house-starter pool for v2 (puzzles >= 260).
 *
 * Drawn from the top 5,000 words of answersV2 excluding words with three or more
 * occurrences of the same letter (Philosophy §9: "Never a triple; that's past
 * interesting and into unfair"). Every starter is guaranteed to be a legitimate
 * answer candidate with zero simple 4-letter + 's' regular plurals.
 */
export const startersV2: readonly string[] = (() => {
  const result: string[] = [];
  for (const word of answersV2) {
    let hasTriple = false;
    const counts = new Uint8Array(26);
    for (let i = 0; i < word.length; i += 1) {
      const idx = word.charCodeAt(i) - 97;
      counts[idx] = (counts[idx] ?? 0) + 1;
      if (counts[idx]! >= 3) {
        hasTriple = true;
        break;
      }
    }
    if (!hasTriple) {
      result.push(word);
      if (result.length === STARTERS_V2_COUNT) break;
    }
  }
  return Object.freeze(result);
})();

