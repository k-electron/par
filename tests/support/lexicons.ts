/**
 * Hand-built fixture lexicons.
 *
 * The engine reads word lists through the injected Lexicon port, never by
 * importing `src/data`, so every engine test runs against one of these instead
 * of the generated lists. That is what keeps the suite fast enough to run
 * constantly, and it is also why these tests can land before the generator has
 * produced anything.
 *
 * Every word below is a real five-letter English word. The families (-atch,
 * -ight, -ound, -aste, -ares) exist so that a single observation leaves a
 * candidate set with genuine structure, which is what makes a search worth
 * testing at all.
 */

import type { Lexicon } from '../../src/engine/words/lexicon';

/**
 * The smallest interesting lexicon: one observation leaves exactly two
 * candidates.
 *
 * Playing `match` against the answer `catch` returns ⬜🟩🟩🟩🟩, which leaves
 * `batch` and `catch` alive and rules `plumb` out. Spec §10's sharpest scorer
 * check lives here:
 *
 * - `batch` and `catch` are candidates, so either scores 100;
 * - `bongo` separates them but cannot win, so it scores exactly 75;
 * - `haste` returns 🟨🟩⬜🟨⬜ against both, so it separates nothing at all.
 */
export const TWO_CANDIDATE_LEXICON: Lexicon = {
  guesses: ['batch', 'bongo', 'catch', 'haste', 'match', 'plumb'],
  answers: ['batch', 'catch', 'plumb'],
};

/**
 * A lexicon where an observation can leave exactly one legal guess.
 *
 * Playing `grace` against `crane` returns ⬜🟩🟩🟨🟩, fixing r, a and e in
 * position and requiring a c. Of the three dictionary words only `crane`
 * survives, which is spec §10's forced-move case. `grace` is deliberately not
 * in the dictionary: because a played guess always satisfies the constraints it
 * generated, and every surviving candidate does too, a live position whose
 * history is all dictionary words can never have fewer than two legal guesses.
 */
export const FORCED_LEXICON: Lexicon = {
  guesses: ['brine', 'crane', 'plumb'],
  answers: ['brine', 'crane', 'plumb'],
};

const FAMILIES = [
  'batch',
  'catch',
  'hatch',
  'latch',
  'match',
  'patch',
  'watch',
  'eight',
  'fight',
  'light',
  'might',
  'night',
  'right',
  'sight',
  'tight',
  'bound',
  'found',
  'hound',
  'mound',
  'pound',
  'round',
  'sound',
  'wound',
  'baste',
  'haste',
  'paste',
  'taste',
  'waste',
  'bares',
  'cares',
  'dares',
  'fares',
  'hares',
  'mares',
  'pares',
  'wares',
];

const PROBES = [
  'adieu',
  'arise',
  'audio',
  'blimp',
  'bongo',
  'brick',
  'champ',
  'chess',
  'chomp',
  'climb',
  'count',
  'crane',
  'crumb',
  'dwarf',
  'flick',
  'glyph',
  'irate',
  'jumpy',
  'knoll',
  'later',
  'mount',
  'notes',
  'plumb',
  'quirk',
  'raise',
  'ratio',
  'roast',
  'slate',
  'snout',
  'spout',
  'stare',
  'thumb',
  'trace',
  'truss',
  'vodka',
  'wharf',
  'widow',
  'yacht',
  'zesty',
];

/**
 * The general-purpose fixture: 75 legal guesses, 28 possible answers.
 *
 * Small enough that a brute-force policy can evaluate every legal guess at
 * every node, which is what makes it the reference the approximate policies are
 * checked against.
 */
export const FIXTURE_LEXICON: Lexicon = {
  guesses: [...FAMILIES, ...PROBES].sort((left, right) => (left < right ? -1 : 1)),
  answers: [
    'batch',
    'bound',
    'catch',
    'climb',
    'count',
    'crane',
    'fight',
    'found',
    'hatch',
    'latch',
    'light',
    'match',
    'might',
    'mount',
    'night',
    'patch',
    'right',
    'round',
    'sight',
    'slate',
    'sound',
    'stare',
    'taste',
    'thumb',
    'tight',
    'trace',
    'waste',
    'watch',
  ],
};

/** A single word: the degenerate case where the only legal guess is the answer. */
export const SINGLE_WORD_LEXICON: Lexicon = {
  guesses: ['crane'],
  answers: ['crane'],
};
