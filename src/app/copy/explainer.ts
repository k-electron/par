/**
 * Where *this* round's numbers came from.
 *
 * The explainer taught the model in the abstract and left the reader to map it
 * onto their own card. Everything here is the same model said with the round's
 * own guesses in it: what each guess scored and why, how those scores became
 * one skill figure, what par paid, and how the parts add up to the total on the
 * card.
 *
 * Three constraints shape it, and all three are why this is a copy module
 * rather than prose inside the component.
 *
 * **It computes no score.** Every figure is read off the score the engine
 * already produced. The one arithmetic here is a share of the skill average,
 * which is a weight the scorer recorded divided by the sum of them. Nothing in
 * this file can move a total, and a round scored months ago explains itself
 * from the same fields it always carried.
 *
 * **It cannot count the answer pool, by construction.** `RoundToExplain` is a
 * structural subset of `GameScore` that omits `candidateCount` and
 * `remainingCount` entirely, so the size of the field is not a number this
 * module could print if it wanted to — the same guarantee `scoreGuess` gets by
 * never returning the argmin. What survives is `weight`, which is `log2 |S_i|`,
 * and it is only ever shown as a share of the round's total weight: a ratio
 * between two logarithms fixes neither of them. Decision 0003 has the argument
 * for why the count itself stays ours.
 *
 * **The arithmetic on screen has to add up on screen.** Points are shown to two
 * decimals rather than the card's one, because parts rounded to a tenth sum to
 * the wrong tenth about half the time, and an explanation whose own addition
 * looks broken is worse than no explanation.
 */

import { C_PAR, PAR, UNSOLVED_GUESSES } from '../../engine/config/constants';
import { LUCK_NOTICEABLE, NEAR_BEST } from './results';

/** A guess, as this module is allowed to see it. No count of anything. */
export interface GuessToExplain {
  readonly turn: number;
  readonly guess: string;
  /** `s_i`, or null for the opener, which is never scored. */
  readonly skill: number | null;
  /** `log2 |S_i|`. Shown only ever as a share of the round's total. */
  readonly weight: number;
  readonly luck: number;
  readonly forced: boolean;
  /** Whether the guess could itself still have been the answer. */
  readonly wasCandidate: boolean;
  /** The share of the field the tiles left standing. A ratio, never a count. */
  readonly outcomeShare: number;
  /** The share the guess's likeliest pattern would have left standing. */
  readonly likeliestOutcomeShare: number;
}

export interface RoundToExplain {
  readonly skill: number;
  readonly outcome: number;
  readonly starterBonus: number;
  readonly total: number;
  readonly guessesUsed: number;
  readonly solved: boolean;
  readonly breakdown: readonly GuessToExplain[];
}

export interface ExplainedGuess {
  readonly turn: number;
  readonly guess: string;
  /** What the skill column on this row means, in a sentence. */
  readonly skillStory: string;
  /** What the luck column on this row means, in a sentence. */
  readonly luckStory: string;
}

/** One scored guess's line in the skill average. */
export interface SkillShare {
  readonly guess: string;
  /** `86.5%`. */
  readonly score: string;
  /** `64% of the average`, or that it counted for none of it. */
  readonly share: string;
}

export interface ExplainedFigure {
  readonly figure: string;
  readonly story: string;
}

export interface ExplainedRound {
  readonly lead: string;
  readonly guesses: readonly ExplainedGuess[];
  readonly skill: ExplainedFigure & {
    readonly shares: readonly SkillShare[];
    readonly result: string;
  };
  readonly par: ExplainedFigure;
  readonly bonus: ExplainedFigure;
  readonly total: ExplainedFigure;
}

const MINUS = '\u2212';
const TIMES = '\u00d7';
const DASH = '\u2014';

/** `86.5%`. A tenth, so the weighted average below reproduces on paper. */
function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** `2.84`, `−13.16`. Two decimals, so the sum on screen adds up. */
function points(value: number): string {
  return value < 0 ? `${MINUS}${(-value).toFixed(2)}` : value.toFixed(2);
}

function signedPoints(value: number): string {
  return value < 0 ? points(value) : `+${points(value)}`;
}

/** `−0.6`, matching the luck column to the tenth it shows. */
function bits(value: number): string {
  return value < 0 ? `${MINUS}${(-value).toFixed(1)}` : `+${value.toFixed(1)}`;
}

/**
 * A share of the field as a fraction anyone can picture.
 *
 * Fractions rather than percentages because these are read in the middle of a
 * sentence about what a guess risked, where "38.8%" invites arithmetic and
 * "about two fifths" invites a picture. Nearest of a short ladder, so two rows
 * that risked much the same thing say much the same thing.
 */
const FRACTIONS: readonly { readonly at: number; readonly text: string }[] = [
  { at: 0.5, text: 'about half the field' },
  { at: 0.4, text: 'about two fifths of the field' },
  { at: 1 / 3, text: 'about a third of the field' },
  { at: 0.25, text: 'about a quarter of the field' },
  { at: 0.2, text: 'about a fifth of the field' },
  { at: 0.1, text: 'about a tenth of the field' },
];

function fieldShare(share: number): string {
  if (share > 0.62) return 'most of the field';
  if (share < 0.06) return 'a sliver of the field';

  let closest = FRACTIONS[0]!;
  for (const fraction of FRACTIONS) {
    if (Math.abs(share - fraction.at) < Math.abs(share - closest.at)) {
      closest = fraction;
    }
  }
  return closest.text;
}

/**
 * A gap as a percentage, rounded to the nearest twentieth once it is wide
 * enough for the precision to be false.
 *
 * A tenth of a turn either way is not a measurement this model can defend, and
 * "about 17% more turns" invites a reader to believe it can. Small gaps keep
 * their digit because rounding those to a twentieth would print "about 0%".
 */
function roughPercent(fraction: number): string {
  const rounded = fraction < 0.1 ? fraction : Math.round(fraction * 20) / 20;
  return `${(rounded * 100).toFixed(0)}%`;
}

/**
 * How much slower than the best available play a guess was heading, from its
 * score alone.
 *
 * The score is `Q(best) / Q(played)`, so its reciprocal is the turns the guess
 * was heading for against the turns the position had in it. Stated this way
 * round because a reader can picture "about 15% more turns" and cannot picture
 * "87.5% of the turns the best play needed" — that phrasing is what this whole
 * module was reworked to get rid of.
 */
function moreTurns(skill: number): string {
  const factor = 100 / skill;

  if (factor >= 1.75) {
    const names = ['twice', 'three times', 'four times'];
    const rounded = Math.min(Math.max(Math.round(factor), 2), names.length + 1);
    return `${names[rounded - 2]} as many turns as`;
  }

  return `about ${roughPercent(factor - 1)} more turns than`;
}

/**
 * The luck figure as a size, rather than in bits.
 *
 * A bit is a halving, so `2^-luck` is exactly how the field came out against
 * what a guess like that usually leaves — the same number the column shows,
 * said as something a reader can see. Percentages under a doubling and
 * multiples over it, because "about 140% as many" is not a sentence.
 *
 * The two directions are not the same arithmetic, which is the easy thing to
 * get wrong here. A field that came out `f` times too big is `(f − 1)` more
 * than usual, but one that came out `f` times too small is `(1 − 1/f)` fewer,
 * not `(f − 1)` fewer. Both are computed from the multiple below rather than
 * from each other.
 *
 * The clause carries its own connector, because a multiple takes "as" and a
 * percentage takes "than".
 */
const MULTIPLES = ['twice', 'three times', 'four times', 'five times'];
const FRACTIONS_OF = ['half', 'a third', 'a quarter', 'a fifth'];

function sizeGap(luck: number): string {
  const factor = Math.pow(2, Math.abs(luck));

  if (factor < 2) {
    const gap = luck < 0 ? factor - 1 : 1 - 1 / factor;
    return luck < 0
      ? `about ${roughPercent(gap)} more words in play than`
      : `about ${roughPercent(gap)} fewer words in play than`;
  }

  // Past the ladder, a named multiple would be an understatement dressed as a
  // measurement: an eighth reported as "about a fifth" is simply wrong.
  const step = Math.round(factor) - 2;
  if (step >= MULTIPLES.length) {
    return luck < 0
      ? 'several times as many words in play as'
      : 'a small fraction of the words in play that';
  }

  return luck < 0
    ? `about ${MULTIPLES[step]} as many words in play as`
    : `about ${FRACTIONS_OF[step]} as many words in play as`;
}

/**
 * A guess count, trimmed of the zeros `PAR` is generated with.
 *
 * `PAR` carries four decimals so it can be regenerated precisely, and all four
 * would put `3.7100` in a sentence. Rounding it to two would be worse: the
 * arithmetic printed beside it is `C_PAR × (PAR − n)`, and a reader who
 * multiplies a shortened par gets a different answer from the one on screen.
 */
function guesses(value: number): string {
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Where `percent` starts printing a hundred, so the words agree with the digits. */
const ROUNDS_TO_FULL_MARKS = 99.95;

/**
 * Where a guess was risking enough for the risk to be worth a clause.
 *
 * Every guess risks something, and saying so on every row would bury the rows
 * where it is the story. Two fifths is about where "and it might have told you
 * very little" stops being pedantry.
 */
const NOTABLE_RISK = 0.35;

/**
 * What kind of move it was, which is the part a player can actually learn from.
 *
 * A guess is doing one of two things, and the difference is the single most
 * useful thing this dialog can teach: a live shot can win on the spot, and a
 * word that cannot win is buying information with a turn. The general account
 * below spends a whole section on why the second can beat the first; naming
 * which one each row was is what connects that lesson to the reader's own card.
 */
function kindOfMove(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();
  return row.wasCandidate
    ? `${word} could have won outright`
    : `${word} could not have been the answer by then, so it was a pure question`;
}

function skillStory(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();

  if (row.skill === null) {
    return (
      `Not scored ${DASH} openers never are. What an opener is worth shows up in par instead, ` +
      'through the position it leaves.'
    );
  }

  const score = percent(row.skill);

  // A single-word field weighs log2 1 = 0, so such a row sits on screen with a
  // score that cannot reach the average. Saying so is the difference between a
  // reader thinking the figure above is wrong and understanding why it is right.
  // Full marks there can only mean the one word was the one played, which the
  // row it sits on already says out loud by winning.
  if (row.weight === 0) {
    return row.skill >= ROUNDS_TO_FULL_MARKS
      ? `Skill ${score} ${DASH} only one word was still possible, and ${word} was it. It counts ` +
          'for nothing in the average either way.'
      : `Skill ${score} ${DASH} one word was still possible by then, and ${word} was not it. ` +
          'It counts for nothing in the average either way.';
  }

  if (row.forced) {
    return `Skill ${score} ${DASH} the position offered no real choice, so nothing better than ${word} existed.`;
  }
  if (row.skill >= ROUNDS_TO_FULL_MARKS) {
    return `Skill ${score} ${DASH} ${kindOfMove(row)}. Nothing available would have finished sooner.`;
  }
  if (row.skill >= NEAR_BEST) {
    return `Skill ${score} ${DASH} ${kindOfMove(row)}. It was close to the quickest way home from there.`;
  }

  // Below the table's own "near best" band, the gap is worth pricing rather
  // than describing, and what the guess was risking is worth naming: a reader
  // asking why this row is the low one wants the reason, not the ratio.
  const risk =
    row.likeliestOutcomeShare >= NOTABLE_RISK
      ? ` Its likeliest break would still have left ${fieldShare(row.likeliestOutcomeShare)} standing.`
      : '';

  return (
    `Skill ${score} ${DASH} ${kindOfMove(row)}.${risk} From there it was heading for ` +
    `${moreTurns(row.skill)} the best play available.`
  );
}

function luckStory(row: GuessToExplain, won: boolean): string {
  const word = row.guess.toUpperCase();

  // A field already down to one word has nothing left to decide, so the tiles
  // could not have been kind or cruel. The old line said they broke as expected,
  // which is true and says nothing.
  //
  // This is checked before the winning row below, not after: a round that walks
  // in the last possible word wins on a dead field, where the luck figure is
  // exactly zero and "finishing turns over everything" would be captioning a
  // 0.0 as though it were the round's big number.
  //
  // `skill !== null` is load-bearing rather than defensive: the opener also
  // weighs zero, because guess 1 is never scored whatever it faced, and it is
  // the one row of the round facing the whole answer list.
  if (row.skill !== null && row.weight === 0) {
    return `Luck ${bits(row.luck)} ${DASH} with one word left, there was nothing for the tiles to decide.`;
  }

  // The winning row's luck is otherwise always positive, because finishing is
  // the most informative thing that can happen to a guess. Left unsaid, that
  // number reads as a second helping of praise for the guess that happened to
  // land, which is the one reading the whole separation of skill from luck
  // exists to prevent.
  if (won) {
    return (
      `Luck ${bits(row.luck)} ${DASH} ${word} came home. Finishing turns over everything there ` +
      'was left to find out, which is why the figure is large.'
    );
  }

  if (Math.abs(row.luck) <= LUCK_NOTICEABLE) {
    return `Luck ${bits(row.luck)} ${DASH} the tiles broke about as they usually do for a guess like ${word}.`;
  }

  // Landing in the guess's biggest bucket is the least informative thing that
  // could have happened to it, and it is also the most likely — which is why
  // this branch can never fire on a lucky row: realized bits are at their
  // minimum there, so the luck figure cannot be positive.
  if (row.outcomeShare >= row.likeliestOutcomeShare) {
    return (
      `Luck ${bits(row.luck)} ${DASH} the tiles came back the likeliest way ${word} could break, ` +
      `which is also the least it could tell you: ${fieldShare(row.outcomeShare)} was still standing.`
    );
  }

  return `Luck ${bits(row.luck)} ${DASH} the tiles left ${sizeGap(row.luck)} ${word} usually leaves.`;
}

/**
 * Each scored guess's share of the skill average, as whole percentages that sum
 * to a hundred.
 *
 * Largest remainder rather than rounding each share on its own, which would
 * leave a reader adding the column up to 99 and wondering which line was lying
 * to them. Rows weighing nothing are held at zero and take no remainder.
 */
function skillShares(rows: readonly GuessToExplain[]): number[] {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return rows.map(() => 0);

  const exact = rows.map((row) => (row.weight / total) * 100);
  const shares = exact.map((share) => Math.floor(share));
  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .filter(({ index }) => rows[index]!.weight > 0)
    .sort((left, right) => right.remainder - left.remainder);

  let spare = 100 - shares.reduce((sum, share) => sum + share, 0);
  for (const { index } of byRemainder) {
    if (spare <= 0) break;
    shares[index]! += 1;
    spare -= 1;
  }

  return shares;
}

function parStory(round: RoundToExplain): string {
  const par = guesses(PAR);
  const charged = round.solved ? round.guessesUsed : UNSOLVED_GUESSES;
  const took = round.solved
    ? `This round took ${round.guessesUsed}.`
    : `This round did not solve it, and an unsolved round is priced at ${UNSOLVED_GUESSES} guesses.`;

  return (
    `Par is ${par} guesses ${DASH} what strong play averages, so most rounds sit over it. ` +
    `${took} Every guess either side of par is worth the same ${C_PAR} points: ` +
    `${C_PAR} ${TIMES} (${par} ${MINUS} ${charged}) = ${signedPoints(round.outcome)}.`
  );
}

function bonusStory(round: RoundToExplain): string {
  return round.starterBonus > 0
    ? `For taking the day's house starter sight-unseen. It pays for the blind bet rather than ` +
        'for the word, which is why declining it and typing the same word earns nothing.'
    : `None here ${DASH} this round brought its own opener, so there was no blind bet to pay for.`;
}

function totalStory(round: RoundToExplain): string {
  // A zero bonus is left out rather than added as +0.00, which is also how the
  // card shows it: a figure that changes nothing is noise in a sum.
  const sum = [
    points(round.skill),
    `${round.outcome < 0 ? MINUS : '+'} ${points(Math.abs(round.outcome))}`,
    ...(round.starterBonus > 0 ? [`+ ${points(round.starterBonus)}`] : []),
  ].join(' ');

  return (
    `The skill percentage joins the total as points, one for one, and par is added to it: ` +
    `${sum} = ${points(round.total)}.`
  );
}

export function explainRound(round: RoundToExplain): ExplainedRound {
  const scored = round.breakdown.filter(
    (row): row is GuessToExplain & { skill: number } => row.skill !== null,
  );
  const shares = skillShares(scored);
  const weighed = scored.some((row) => row.weight > 0);

  return {
    lead:
      `Every figure on the card comes out of the guesses below. Skill counts turns: how quickly ` +
      `each guess was heading for the answer, against the quickest way home from the same ` +
      `position. Luck is what the tiles then did with it ${DASH} whether they left more or fewer ` +
      `words in play than a guess like that usually leaves. Skill is yours and luck is the ` +
      `board's, which is why only one of them reaches the total.`,

    guesses: round.breakdown.map((row, index) => ({
      turn: row.turn,
      guess: row.guess,
      skillStory: skillStory(row),
      // The last row of a solved round is the guess that finished it. Nothing
      // else in the breakdown identifies the winner, and the winning row's luck
      // needs saying differently — see `luckStory`.
      luckStory: luckStory(row, round.solved && index === round.breakdown.length - 1),
    })),

    skill: {
      figure: percent(round.skill),
      story:
        scored.length === 0
          ? 'Only guesses after the opener are scored, and this round had none.'
          : `Only guesses after the opener are scored, and each counts in proportion to how much ` +
            `was still unknown when it was played ${DASH} so an early guess counts for more ` +
            `than a late one.`,
      shares: scored.map((row, index) => ({
        guess: row.guess,
        score: percent(row.skill),
        share: row.weight > 0 ? `${shares[index]}% of the average` : 'none of the average',
      })),
      result: weighed
        ? `Weighted that way, they come to ${percent(round.skill)}.`
        : `Nothing was left to weigh, so the figure stands at its default, ${percent(round.skill)}.`,
    },

    par: { figure: signedPoints(round.outcome), story: parStory(round) },
    bonus: {
      figure: round.starterBonus > 0 ? signedPoints(round.starterBonus) : 'None',
      story: bonusStory(round),
    },
    total: { figure: points(round.total), story: totalStory(round) },
  };
}
