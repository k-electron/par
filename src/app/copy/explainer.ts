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
import { LUCK_NOTICEABLE } from './results';

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

/** `0.6 of a halving`, `2.2 halvings`. */
function halvings(value: number): string {
  const size = Math.abs(value);
  return size < 1 ? `${size.toFixed(1)} of a halving` : `${size.toFixed(1)} halvings`;
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

function skillStory(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();

  if (row.skill === null) {
    return (
      `Not scored ${DASH} openers never are. What an opener is worth shows up in par instead, ` +
      'through the position it leaves.'
    );
  }

  const score = percent(row.skill);
  const ratio =
    `what the best available play needed from there, as a share of what ${word} needed`;

  // A single-word field weighs log2 1 = 0, so such a row sits on screen with a
  // score that cannot reach the average. Saying so is the difference between a
  // reader thinking the figure above is wrong and understanding why it is right.
  // Full marks there can only mean the one word was the one played, which the
  // row it sits on already says out loud by winning.
  if (row.weight === 0) {
    return row.skill >= ROUNDS_TO_FULL_MARKS
      ? `Skill ${score} ${DASH} only one word was still possible, and ${word} was it. It counts ` +
          'for nothing in the average either way.'
      : `Skill ${score} ${DASH} ${ratio}. Only one word was still possible, so it counts for ` +
          'nothing in the average.';
  }

  if (row.forced) {
    return `Skill ${score} ${DASH} the position offered no real choice, so nothing better than ${word} existed.`;
  }
  if (row.skill >= ROUNDS_TO_FULL_MARKS) {
    return `Skill ${score} ${DASH} nothing available would have finished sooner than ${word}.`;
  }
  return `Skill ${score} ${DASH} ${ratio}.`;
}

function luckStory(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();

  if (Math.abs(row.luck) <= LUCK_NOTICEABLE) {
    return `Luck ${bits(row.luck)} ${DASH} the tiles broke about as ${word} could expect.`;
  }

  const direction = row.luck > 0 ? 'more' : 'less';
  return (
    `Luck ${bits(row.luck)} ${DASH} the tiles revealed ${halvings(row.luck)} ${direction} ` +
    `than ${word} could expect.`
  );
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
      `Every figure on the card comes out of the guesses below. Skill compares a guess with the ` +
      `best play available in that position, in expected guesses to finish. Luck compares what ` +
      `the tiles revealed with what that guess could expect, counted in halvings ${DASH} one ` +
      `halving is the field coming out half the size.`,

    guesses: round.breakdown.map((row) => ({
      turn: row.turn,
      guess: row.guess,
      skillStory: skillStory(row),
      luckStory: luckStory(row),
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
