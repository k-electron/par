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
import { GUESSES_PACKED } from './guesses.generated';
import { STARTERS_PACKED } from './starters.generated';

export { WORD_LIST_VERSION } from './version.generated';

function unpack(packed: string): readonly string[] {
  return Object.freeze(packed.split('\n'));
}

/** Every word a player may type. Collins CSW19 at five letters. */
export const guesses: readonly string[] = unpack(GUESSES_PACKED);

/** The possible answers. Frequency-ranked, a subset of `guesses`. */
export const answers: readonly string[] = unpack(ANSWERS_PACKED);

/**
 * The house-starter pool. Frequency-ranked, letter-filtered, a subset of
 * `guesses`. Never used as the candidate set — only to draw the day's starter.
 */
export const starters: readonly string[] = unpack(STARTERS_PACKED);
