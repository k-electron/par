/**
 * Every player-facing phrase in the results view.
 *
 * Gathered here because the tone is a design constraint, not decoration. The
 * score should read like a golf card, not a report card: a bad guess is priced,
 * never criticised. Keeping the words in one file makes that reviewable in one
 * sitting instead of scattered across components.
 *
 * Three rules hold throughout, and all three are testable because they live
 * here:
 *
 * - **Never name a better word.** Not the optimal guess, not an alternative,
 *   not a hint. Showing someone the word they missed is a lecture, and it
 *   teaches exactly the memorise-the-meta habit the game is built to avoid.
 * - **Never scold.** No "should have", no "mistake", no "wasted". A guess that
 *   cost expected guesses gets a number and moves on.
 * - **Never count the answer pool.** How far a guess narrowed the field is the
 *   interesting part and is said in proportions. The pool's size, and how many
 *   of its words a given pattern leaves, are ours rather than the player's — see
 *   `fieldNote` for why that is a design position rather than an oversight.
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

/**
 * The field cell: how far this guess narrowed what was still possible.
 *
 * **Relative on purpose, and never a count.** The column used to print the pool
 * either side of the guess, which handed over two things it had no business
 * handing over: the answer list's exact size, on every first row, and an exact
 * count of its words consistent with a known guess and pattern. Philosophy's
 * rationale for scoring against that list assumes the opposite — it is "the only
 * self-consistent choice, even though players can't see that pool".
 *
 * A ratio is also the better read. The old number only meant anything beside the
 * one it started from, because a field of 253 is a fine cut from 3000 and a poor
 * one from 260. How far the field fell says that on its own.
 *
 * Banded by integer comparison rather than by `log2(before / after)`, because a
 * band that straddled a floating-point boundary could word the same round
 * differently on two machines, and a replay link is meant to read identically
 * for both friends holding it.
 *
 * **Every rung is a floor, and that is what keeps a coarse band honest.** "Down
 * to a quarter" is true of every cut in its band, because the band begins where
 * a quarter is reached; a sharper cut than that is understated rather than
 * misreported, and the bar beside the phrase is what carries the rest.
 *
 * Phrased as something that happened rather than as a grade. How far the field
 * fell is partly the feedback's doing, so this belongs in the same register as
 * `luckNote` and not in the skill column's.
 *
 * The winning guess is the exception and reports no field at all. One word
 * technically remains after it, but describing what is left invites the reader
 * to wonder what they should do about it when the game is already over. A guess
 * that *lost* the game is not the same case: it narrowed a field that was still
 * standing when the turns ran out, and that is the story of the round.
 */
export function fieldNote(before: number, after: number, won: boolean): string {
  if (won) return 'solved';
  if (after >= before) return 'nothing ruled out';
  if (after * 2 > before) return 'narrowed a little';
  if (after * 4 > before) return 'down to half';
  if (after * 10 > before) return 'down to a quarter';
  if (after * 50 > before) return 'down to a tenth';
  return 'cut to a fraction';
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
    /**
     * What is still standing after the guess on its own row.
     *
     * It used to be "In play" and showed the count going *in*, which described
     * the position the previous guess had left rather than what this one did
     * with it. Then it was "Words left", which reported the count going out and
     * so promised a number the column no longer gives. "Field" is the word the
     * engine already uses for the same quantity — a field that halved reports
     * exactly one bit — and it survives being shown as a proportion.
     */
    field: 'Field',
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
 * The offer to go and look the word up.
 *
 * Deliberately does not name the word. It is on screen either way by the time
 * this shows, so repeating it in the label only makes the line longer — and a
 * generic label is the one that still reads correctly on a round somebody sent
 * you weeks ago.
 */
export const DEFINITION: Record<RoundVariant, string> = {
  own: "What does today's word mean?",
  // A replay of puzzle 100 opened in August is not today's word.
  replay: 'What does this word mean?',
};

/**
 * Where that link goes.
 *
 * The sentence lives here with the rest of the phrasing rather than in the
 * component, because it is the part somebody would want to reword, and keeping
 * it next to the label stops the two describing different things.
 */
export function definitionSearch(word: string): string {
  const question = `what does ${word.toLowerCase()} mean?`;
  return `https://www.google.com/search?q=${encodeURIComponent(question)}`;
}

/**
 * How a finished round is summed up in a line, once its last row has settled.
 *
 * The unsolved case is the one that carries the answer, and it is the reason
 * these are here rather than inline: the replay used to show no outcome at all,
 * so a round somebody lost never named the word. Same sentence, bent for whose
 * round it is.
 */
export const OUTCOME: Record<
  RoundVariant,
  { solved: (used: number, allowed: number) => string; lost: (answer: string) => string }
> = {
  own: {
    solved: (used, allowed) => `Solved in ${used} of ${allowed}.`,
    lost: (answer) => `Out of guesses. The answer was ${answer.toUpperCase()}.`,
  },
  replay: {
    solved: (used, allowed) => `Solved in ${used} of ${allowed}.`,
    lost: (answer) => `They ran out of guesses. The answer was ${answer.toUpperCase()}.`,
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

/**
 * Every badge the results view shows, in the order it shows them.
 *
 * Factual first, then celebratory. The factual set is this surface's own: unlike
 * the shared text there is no attempt line here carrying solved-or-not, so a
 * badge has to say it.
 *
 * A plain function rather than something inside the component, so the full
 * cross-product of inputs can be checked without mounting the view 768 times.
 */
export function resultsBadges(
  score: { readonly solved: boolean; readonly guessesUsed: number; readonly skill: number },
  settings: { readonly hardMode: boolean; readonly useHouseStarter: boolean },
): string[] {
  return [
    settings.useHouseStarter ? BADGES.houseStarter : BADGES.ownOpener,
    ...(settings.hardMode ? [BADGES.hardMode] : []),
    score.solved ? BADGES.solved : BADGES.unsolved,
    ...celebratoryBadges(score).map((badge) => RESULTS_CELEBRATORY[badge]),
  ];
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

/** How the results view words the celebratory badges. Exhaustive by type. */
const RESULTS_CELEBRATORY: Record<CelebratoryBadge, string> = {
  holeInOne: BADGES.holeInOne,
  quickRound: BADGES.quickRound,
  cleanRound: BADGES.cleanRound,
};
