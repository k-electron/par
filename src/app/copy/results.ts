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
 * - **Never count the answer pool.** How far a guess got is the interesting
 *   part and is said in bands. The pool's size, and how many of its words a
 *   given pattern leaves, are ours rather than the player's — `progressLevel`
 *   has the argument, and `docs/decisions/0003` the full account.
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
  if (skill >= NEAR_BEST) return 'Near best';
  if (skill >= REASONABLE) return 'Reasonable';
  return 'Cost about a turn';
}

/**
 * Where a skill score stops reading as "close to the best there was".
 *
 * Exported for the same reason `LUCK_NOTICEABLE` is: the explainer describes
 * the same row in a sentence, and a guess badged `Near best` in the table that
 * is then told in the dialog how many more turns it was heading for is two
 * surfaces disagreeing about one number.
 */
export const NEAR_BEST = 90;

/**
 * Where a skill score stops reading as "a reasonable play".
 *
 * Exported for `NEAR_BEST`'s reason. The results table colours its skill meter
 * on these same two thresholds, so the bar and the phrase it replaced band the
 * row the same way — a guess called `Reasonable` by the words must not be
 * coloured as though it cost a turn.
 */
export const REASONABLE = 70;

/**
 * Where the track starts, and why it is not zero.
 *
 * `skill` is `100 × best/cost`, a ratio of expected guesses, so it cannot reach
 * 0. Measured over 120 puzzles at three player strengths — about a thousand
 * scored rows — nothing came in below 50. The bottom half of a 0–100 track is
 * unreachable rather than merely unvisited, and spending half the width on it
 * left 95 and 100 drawn almost identically, which is most of where rows land.
 *
 * 50 is where a whole turn goes: `best 1.000, yours 2.000` is one word left and
 * a guess that was not it. So the track covers exactly the range from giving up
 * a turn to giving up nothing.
 *
 * A truncated axis has to disclose itself, and the exact figure under the bar is
 * the disclosure: the bar ranks the rows, the number says what they scored.
 *
 * ponytail: measured, not proved. A score under the floor clamps to an empty
 * track rather than a negative one, and the number beside it still reads
 * correctly, so this degrades rather than lies. Lower it if real rows ever
 * arrive below 50.
 */
const SKILL_FLOOR = 50;

/** The fill's share of the track. Clamped, so a score under the floor is empty. */
export function skillMeterFill(skill: number): number {
  return Math.max(0, ((skill - SKILL_FLOOR) / (100 - SKILL_FLOOR)) * 100);
}

/**
 * How far the tiles have to break from expectation before it is worth saying so.
 *
 * Exported because the explainer needs the same line: a round that reads "broke
 * as expected" in the table and then gets told the tiles revealed less than the
 * guess could expect is two surfaces disagreeing about one number.
 */
export const LUCK_NOTICEABLE = 0.3;

/** The luck figure, phrased as something that happened rather than a grade. */
export function luckNote(bits: number): string {
  if (bits > 1.0) return 'ran hot';
  if (bits > LUCK_NOTICEABLE) return 'broke your way';
  if (bits < -1.0) return 'ran cold';
  if (bits < -LUCK_NOTICEABLE) return 'broke against you';
  return 'broke as expected';
}

/**
 * How much of what was still unknown a guess cleared away.
 *
 * **The one measure, not three.** What matters about a cut is neither its size
 * in words nor its size as a fraction, but its size against how much there was
 * left to find out — which is why this is `log2(before / after) / log2(before)`,
 * the share of the standing uncertainty the guess removed. That single ratio
 * carries all three things a light has to be sensitive to:
 *
 * - **Where the round has got to**, because the denominator shrinks as the field
 *   does. Late narrowing is scarcer, so it counts for more.
 * - **The proportion cut**, which is the numerator.
 * - **The count cut**, because a fraction alone would rate 3000 → 1500 and
 *   2 → 1 the same. Against the uncertainty each faced, the first is a twelfth
 *   of the way home and the second is all of it.
 *
 * So a hundred words struck off a field of three thousand rates near nothing,
 * and one struck off a field of two rates as everything, which is the ordering a
 * player recognises.
 *
 * **Bands by integer comparison, never by logarithm.** `progress >= k / n` is
 * exactly `after^n <= before^(n - k)`, so a threshold at a half is `after² <=
 * before` and a quarter is `after⁴ <= before³`. Both stay whole numbers well
 * inside exact integer range, so no band can straddle a floating-point boundary
 * and word the same round differently on two machines — a replay link must read
 * identically for both friends holding it.
 *
 * **`slight` deliberately covers a cut of nothing as well as a small one.** A
 * guess that ruled nothing out is not separable here, and that is the point: a
 * word still possible always eliminates itself when it fails, so a row that
 * singled out "nothing ruled out" would prove the guess was never a possible
 * answer. Saying "little or nothing" is both honest about the band and mute
 * about which end of it a row sits at.
 *
 * **A field already down to one word gets no light at all.** There was no
 * uncertainty to remove, so there is no progress to report. The scorer reaches
 * the same conclusion by a different route: such a row weighs `log2 1 = 0` in
 * the skill average, so whatever it scores it cannot move the total either way.
 * A red mark would then be the only judgement on a row the score itself declines
 * to count.
 */
export type ProgressLevel = 'solved' | 'major' | 'minor' | 'slight' | 'none';

export function progressLevel(before: number, after: number, won: boolean): ProgressLevel {
  if (won) return 'solved';
  // Nothing was on offer, so nothing is graded. Guarding this first also keeps
  // the comparisons below away from a field of one, where every cut is zero.
  if (before <= 1) return 'none';
  // progress >= 1/2.
  if (after * after <= before) return 'major';
  // progress >= 1/4.
  if (after * after * after * after <= before * before * before) return 'minor';
  return 'slight';
}

/**
 * What each band says. Read aloud rather than drawn since the table went
 * visual, which does not soften them: descriptions of the field, never verdicts
 * on the player. How far a guess got is partly the feedback's doing, so these
 * read in the same register as `luckNote` rather than the skill column's.
 */
export const PROGRESS: Record<ProgressLevel, string> = {
  solved: 'solved',
  major: 'a big cut',
  minor: 'a fair cut',
  slight: 'little or nothing',
  none: 'nothing left to cut',
};

export const RESULTS = {
  totalLabel: 'Total',
  skillLabel: 'Skill',
  parLabel: 'Par',
  bonusLabel: 'Starter bonus',
  breakdownTitle: 'Guess by guess',
  unsolved: 'Not solved',
  /** Column headers for the per-guess table. */
  columns: {
    /**
     * The word played. It read `#` over a column that has carried the guess and
     * never its number since the table had one.
     */
    turn: 'Guess',
    /**
     * How far the guess on this row got, rather than how many words it left.
     *
     * It was "In play" and showed the count going *in*, which described the
     * position the previous guess had left rather than what this one did with it.
     * Then "Words left", which reported the count going out and so promised a
     * number the column no longer gives — see `progressLevel` for why it stopped
     * giving one.
     */
    progress: 'Progress',
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
