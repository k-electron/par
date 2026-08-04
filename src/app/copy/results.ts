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

import {
  CLEAN_ROUND_SKILL,
  QUICK_ROUND_GUESSES,
  UNSOLVED_GUESSES,
} from '../../engine/config/constants';

const STROKE_WORDS = ['level', 'a stroke', 'two strokes', 'three strokes', 'four strokes'];

/**
 * "1.5 strokes under par", "level with par", "a stroke over par".
 *
 * The unsolved floor comes from the constant rather than a literal 7, because
 * this sentence is rendered directly beside the points `outcomePoints` computed
 * from the same floor. A hardcoded copy would let the words disagree with the
 * number under them the moment the floor moved.
 */
export function parPhrase(guessesUsed: number, par: number, solved: boolean): string {
  const effective = solved ? guessesUsed : UNSOLVED_GUESSES;
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
  // Shares the badge's threshold on purpose: the prose and the chip should agree
  // about what counts as clean, or a round gets badged while the sentence above
  // it declines to say so.
  if (skill >= CLEAN_ROUND_SKILL) return 'Just about flawless.';
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
  // Only the opener is unscored now. A guess facing one candidate scores 100
  // with zero weight, so it reports a score like any other.
  if (skill === null) return turn === 1 ? 'Opener, not scored' : 'Not scored';
  if (candidateCount <= 1) return 'Only one word left';
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

/**
 * Whose round is on screen.
 *
 * The results view serves two places: the game you just played, and a round
 * somebody sent you. Every second-person phrase has to bend with it, or the
 * replay ends up captioning another player's board "Your round" directly under
 * a header that says it is somebody else's.
 */
export type RoundVariant = 'own' | 'replay';

export const ROUND: Record<RoundVariant, { title: string; pending: string }> = {
  own: { title: 'Your round', pending: 'Working out your round\u2026' },
  replay: { title: 'Their round', pending: 'Working out their round\u2026' },
};

export const SHARE: Record<RoundVariant, { action: string; copied: string }> = {
  own: {
    action: 'Share',
    copied: 'Copied. The link shows your game, not the answer.',
  },
  replay: {
    action: 'Copy this round',
    copied: 'Copied. The link shows their game, not the answer.',
  },
};

/**
 * The celebratory badges a finished round has earned.
 *
 * **The only place these rules live.** Two surfaces show them — the results view
 * and the shared text — and they used to test the same three conditions
 * independently, which meant tuning a threshold in one place left the screen
 * disagreeing with the text a player pastes to friends. Same class of divergence
 * as a score that differs between machines, just cheaper to notice.
 *
 * Returns keys rather than words because the two surfaces phrase them
 * differently on purpose: "Clean round" reads as a chip, "✨ clean round" reads
 * in a message. Both render from an exhaustive `Record`, so adding a fourth
 * badge fails to compile until each surface has decided how to show it.
 *
 * The factual badges — starter choice, hard mode, solved or not — are
 * deliberately *not* here. The shared text omits two of them because its first
 * line already carries them, and unifying that would add noise to everything
 * anyone pastes.
 */
export type CelebratoryBadge = 'holeInOne' | 'quickRound' | 'cleanRound';

export function celebratoryBadges(score: {
  readonly solved: boolean;
  readonly guessesUsed: number;
  readonly skill: number;
}): CelebratoryBadge[] {
  if (!score.solved) return [];

  const earned: CelebratoryBadge[] = [];
  if (score.guessesUsed === 1) earned.push('holeInOne');
  else if (score.guessesUsed <= QUICK_ROUND_GUESSES) earned.push('quickRound');
  if (score.skill >= CLEAN_ROUND_SKILL) earned.push('cleanRound');
  return earned;
}

export const BADGES = {
  houseStarter: 'House starter',
  ownOpener: 'Own opener',
  hardMode: 'Hard mode',
  solved: 'Solved',
  unsolved: 'Unsolved',
  /** Celebratory, and cosmetic by design: these must never carry points. */
  holeInOne: 'Hole in one',
  // Fires at three guesses or fewer, so it must not name a number — a
  // two-guess solve badged "in three" reads like a bug.
  quickRound: 'Quick round',
  cleanRound: 'Clean round',
} as const;
