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
 * The house-starter pool. Frequency-ranked, letter-filtered, a subset of
 * `guesses`. Never used as the candidate set — only to draw the day's starter.
 */
export const starters: readonly string[] = unpack(STARTERS_PACKED);

