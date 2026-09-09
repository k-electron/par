/**
 * Drawing the day's answer and house starter.
 *
 * Both come from the puzzle number alone, so two people on the same day get the
 * same puzzle with no server to coordinate it (spec §5). The draws are
 * independent: the same day's answer and starter are chosen by separately
 * salted mixes, so knowing one tells you nothing about the other.
 *
 * No `Math.random`, no clock, no locale. `drawPuzzle` is a pure function of its
 * arguments, which is what makes the golden determinism tests meaningful.
 */

/**
 * SplitMix32 finalising mix.
 *
 * Chosen because it is defined entirely in terms of `Math.imul`, XOR and
 * unsigned shifts — integer operations with identical results on every engine.
 * A float-based hash would risk the same cross-client divergence the private
 * `log2` exists to avoid.
 */
function mix32(input: number): number {
  let z = (input + 0x9e37_79b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0_aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a_2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/**
 * Independent salts. Without these the two draws would be perfectly correlated
 * and every day's starter would be a fixed offset from its answer.
 */
const ANSWER_SALT = 0x5061_7241; // 'ParA'
const STARTER_SALT = 0x5061_7253; // 'ParS'

/**
 * Word selection v2 cutover day.
 * Puzzles before this day draw from the legacy 3,000-word answer list.
 * Puzzles from this day onwards use weighted selection over the 9,570-word v2 candidate list.
 */
export const CUTOVER_PUZZLE_NUMBER = 260;

/** Tier 1: Top 2,500 words by frequency (indices 0..2499) weighted 10. */
export const V2_TIER_1_COUNT = 2_500;
export const V2_TIER_1_WEIGHT = 10;
export const V2_TIER_1_CUMULATIVE = V2_TIER_1_COUNT * V2_TIER_1_WEIGHT; // 25,000

/** Tier 2: Next 2,500 words by frequency (indices 2500..4999) weighted 4. */
export const V2_TIER_2_COUNT = 2_500;
export const V2_TIER_2_WEIGHT = 4;
export const V2_TIER_2_CUMULATIVE = V2_TIER_1_CUMULATIVE + V2_TIER_2_COUNT * V2_TIER_2_WEIGHT; // 35,000

/** Tier 3: Next 2,500 words by frequency (indices 5000..7499) weighted 2. */
export const V2_TIER_3_COUNT = 2_500;
export const V2_TIER_3_WEIGHT = 2;
export const V2_TIER_3_CUMULATIVE = V2_TIER_2_CUMULATIVE + V2_TIER_3_COUNT * V2_TIER_3_WEIGHT; // 40,000

/** Tier 4: Remaining 2,070 words (indices 7500..9569, including pure verbs) weighted 1. */
export const V2_TOTAL_WORDS = 9_570;
export const V2_TIER_4_WEIGHT = 1;
export const V2_TOTAL_WEIGHT =
  V2_TIER_3_CUMULATIVE + (V2_TOTAL_WORDS - (V2_TIER_1_COUNT + V2_TIER_2_COUNT + V2_TIER_3_COUNT)) * V2_TIER_4_WEIGHT; // 42,070

function drawIndex(puzzleNumber: number, salt: number, listLength: number): number {
  if (!Number.isSafeInteger(puzzleNumber)) {
    throw new RangeError(`Puzzle number ${puzzleNumber} is not an integer.`);
  }
  if (!Number.isSafeInteger(listLength) || listLength <= 0) {
    throw new RangeError(`Cannot draw from a list of length ${listLength}.`);
  }
  // `| 0` first so negative puzzle numbers mix as well as positive ones.
  return mix32((puzzleNumber | 0) ^ salt) % listLength;
}

/**
 * Weighted index selection for word selection v2.
 * Deterministic mapping from puzzleNumber to a word index in [0, V2_TOTAL_WORDS - 1].
 */
export function drawWeightedIndex(puzzleNumber: number, salt: number): number {
  if (!Number.isSafeInteger(puzzleNumber)) {
    throw new RangeError(`Puzzle number ${puzzleNumber} is not an integer.`);
  }
  const ticket = mix32((puzzleNumber | 0) ^ salt) % V2_TOTAL_WEIGHT;
  if (ticket < V2_TIER_1_CUMULATIVE) {
    return Math.floor(ticket / V2_TIER_1_WEIGHT);
  }
  if (ticket < V2_TIER_2_CUMULATIVE) {
    return V2_TIER_1_COUNT + Math.floor((ticket - V2_TIER_1_CUMULATIVE) / V2_TIER_2_WEIGHT);
  }
  if (ticket < V2_TIER_3_CUMULATIVE) {
    return (
      V2_TIER_1_COUNT +
      V2_TIER_2_COUNT +
      Math.floor((ticket - V2_TIER_2_CUMULATIVE) / V2_TIER_3_WEIGHT)
    );
  }
  return (
    V2_TIER_1_COUNT +
    V2_TIER_2_COUNT +
    V2_TIER_3_COUNT +
    Math.floor((ticket - V2_TIER_3_CUMULATIVE) / V2_TIER_4_WEIGHT)
  );
}

export interface DailyPuzzle {
  readonly puzzleNumber: number;
  readonly answer: string;
  readonly starter: string;
  /**
   * True on the roughly once-a-decade day when the starter is the answer.
   * Spec §5 says to let it stand — house-takers get a free one-shot — so this
   * exists for the UI to celebrate it, not to suppress it.
   */
  readonly starterIsAnswer: boolean;
}

export interface PuzzleLists {
  readonly answers: readonly string[];
  readonly starters: readonly string[];
  /** The v2 master candidate word list (9,570 words). Used from CUTOVER_PUZZLE_NUMBER onwards. */
  readonly answersV2?: readonly string[];
}

/** The puzzle for a given day. Pure, total, and identical on every machine. */
export function drawPuzzle(puzzleNumber: number, lists: PuzzleLists): DailyPuzzle {
  let answer: string | undefined;
  if (puzzleNumber >= CUTOVER_PUZZLE_NUMBER && lists.answersV2 !== undefined) {
    const index = drawWeightedIndex(puzzleNumber, ANSWER_SALT);
    answer = lists.answersV2[index];
  } else {
    answer = lists.answers[drawIndex(puzzleNumber, ANSWER_SALT, lists.answers.length)];
  }

  const starter = lists.starters[drawIndex(puzzleNumber, STARTER_SALT, lists.starters.length)];

  if (answer === undefined || starter === undefined) {
    throw new RangeError(`Puzzle ${puzzleNumber} drew outside the word lists.`);
  }

  return { puzzleNumber, answer, starter, starterIsAnswer: answer === starter };
}

