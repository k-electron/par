/**
 * Every player-facing phrase in the results view.
 *
 * Gathered here because the tone is a design constraint, not decoration. The
 * score should read like a golf card, not a report card: a bad guess is priced,
 * never criticised. Keeping the words in one file makes that reviewable in one
 * sitting instead of scattered across components.
 *
 * Two rules hold throughout, and both are testable because they live here:
 *
 * - **Never name a better word.** Not the optimal guess, not an alternative,
 *   not a hint. Showing someone the word they missed is a lecture, and it
 *   teaches exactly the memorise-the-meta habit the game is built to avoid.
 * - **Never scold.** No "should have", no "mistake", no "wasted". A guess that
 *   cost expected guesses gets a number and moves on.
 *
 * Par is anchored to strong play, so **most players are over par most days**.
 * The over-par phrasing is therefore the main path and gets the same care as the
 * celebratory one.
 */

const STROKE_WORDS = ['level', 'a stroke', 'two strokes', 'three strokes', 'four strokes'];

/** "1.5 under par", "level par", "half a stroke over". */
export function parPhrase(guessesUsed: number, par: number, solved: boolean): string {
  const effective = solved ? guessesUsed : 7;
  const difference = par - effective;
  const size = Math.abs(difference);

  if (size < 0.05) return 'level with par';

  const rounded = Math.round(size * 10) / 10;
  const magnitude =
    Number.isInteger(rounded) && rounded <= 4
      ? STROKE_WORDS[rounded]!
      : `${rounded.toFixed(1)} strokes`;

  return difference > 0 ? `${magnitude} under par` : `${magnitude} over par`;
}

/** "played at 94%" — the skill figure, phrased as a description. */
export function skillPhrase(skill: number): string {
  return `played at ${skill.toFixed(0)}%`;
}

/**
 * A warm one-liner for the headline.
 *
 * Deliberately not graded. A player who read the position well and got unlucky
 * hears about the reading; a player who guessed well and got lucky hears about
 * the luck. Neither hears a verdict on their worth.
 */
export function headline(skill: number, solved: boolean): string {
  if (!solved) {
    return skill >= 85
      ? 'The words did not fall your way. You read the position well.'
      : 'A tough one. It happens to everybody.';
  }
  if (skill >= 97) return 'Just about flawless.';
  if (skill >= 90) return 'Sharp all the way through.';
  if (skill >= 75) return 'Solid work.';
  if (skill >= 55) return 'Got there. A couple of turns had more on offer.';
  return 'Got there, and that is the main thing.';
}

/**
 * How a single guess's skill score reads in the breakdown.
 *
 * A guess goes unscored for two different reasons and they must not read the
 * same. The opener is excluded by design. A later guess is excluded when only
 * one word was still possible, because its weight is `log2 1 = 0` and it could
 * not move the average either way — calling that one an opener would be simply
 * wrong on the sixth row.
 */
export function guessNote(
  skill: number | null,
  forced: boolean,
  turn: number,
  candidateCount: number,
): string {
  if (skill === null) {
    if (turn === 1) return 'Opener, not scored';
    return candidateCount <= 1 ? 'Only one word left' : 'Not scored';
  }
  if (forced) return 'Forced — nothing better existed';
  if (skill >= 99) return 'Best available';
  if (skill >= 90) return 'Near best';
  if (skill >= 70) return 'Reasonable';
  return 'Cost about a turn';
}

/** The luck figure, phrased as something that happened rather than a grade. */
export function luckNote(bits: number): string {
  if (bits > 1.0) return 'ran hot';
  if (bits > 0.3) return 'broke your way';
  if (bits < -1.0) return 'ran cold';
  if (bits < -0.3) return 'broke against you';
  return 'broke as expected';
}

export const RESULTS = {
  title: 'Your round',
  totalLabel: 'Total',
  skillLabel: 'Skill',
  parLabel: 'Par',
  bonusLabel: 'Starter bonus',
  breakdownTitle: 'Guess by guess',
  unsolved: 'Not solved',
  /** Column headers for the per-guess table. */
  columns: {
    turn: '#',
    candidates: 'In play',
    skill: 'Skill',
    luck: 'Luck',
  },
  explainerLink: 'How is this scored?',
} as const;

export const BADGES = {
  houseStarter: 'House starter',
  ownOpener: 'Own opener',
  hardMode: 'Hard mode',
  solved: 'Solved',
  unsolved: 'Unsolved',
  /** Celebratory, and cosmetic by design: these must never carry points. */
  holeInOne: 'Hole in one',
  quickRound: 'Under par in three',
  cleanRound: 'Clean round',
} as const;
