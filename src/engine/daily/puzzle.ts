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
}

/** The puzzle for a given day. Pure, total, and identical on every machine. */
export function drawPuzzle(puzzleNumber: number, lists: PuzzleLists): DailyPuzzle {
  const answer = lists.answers[drawIndex(puzzleNumber, ANSWER_SALT, lists.answers.length)];
  const starter = lists.starters[drawIndex(puzzleNumber, STARTER_SALT, lists.starters.length)];

  if (answer === undefined || starter === undefined) {
    throw new RangeError(`Puzzle ${puzzleNumber} drew outside the word lists.`);
  }

  return { puzzleNumber, answer, starter, starterIsAnswer: answer === starter };
}
