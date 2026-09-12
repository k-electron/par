/**
 * Explainer copy generator for a completed round.
 *
 * Key constraints:
 * - Computes no score; figures are read directly from the engine.
 * - Cannot count or expose the answer pool size (`RoundToExplain` structurally omits candidate counts).
 * - Formats points to two decimals so displayed components visibly sum to the total.
 */

import { C_PAR, PAR, UNSOLVED_GUESSES } from '../../engine/config/constants';
import { computeDynamicZones, zoneForScore, type ScoreZone, type ZoneDefinition } from '../scoring/zones';
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
  /** Where the guess sat among the words that still fitted, 0 likeliest to 1. */
  readonly standing: number;
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
  readonly par?: number;
  readonly maxScore?: number;
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

export interface ExplainedZoneThreshold {
  readonly id: ScoreZone;
  readonly label: string;
  readonly minScore: number;
  readonly maxScore: number;
  readonly color: { readonly light: string; readonly dark: string };
  readonly isCurrent: boolean;
}

export interface ExplainedZones {
  readonly activeZone: ZoneDefinition;
  readonly parScore: number;
  readonly meterMinScore: number;
  readonly meterMaxScore: number;
  readonly isBlind: boolean;
  readonly isBlindLuck: boolean;
  readonly zones: readonly ExplainedZoneThreshold[];
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
  readonly zones: ExplainedZones;
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
  { at: 0.5, text: 'about half' },
  { at: 0.4, text: 'about two fifths' },
  { at: 1 / 3, text: 'about a third' },
  { at: 0.25, text: 'about a quarter' },
  { at: 0.2, text: 'about a fifth' },
  { at: 0.1, text: 'about a tenth' },
];

function fieldShare(share: number): string {
  if (share > 0.62) return 'most';
  if (share < 0.06) return 'a sliver';

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
 * Formats luck bits (`2^-luck`) into human-readable relative field size changes
 * (percentages for small shifts, multiples for large shifts).
 */
const MULTIPLES = ['twice', 'three times', 'four times', 'five times'];
const FRACTIONS_OF = ['half', 'a third', 'a quarter', 'a fifth'];

function sizeGap(luck: number): string {
  const factor = Math.pow(2, Math.abs(luck));

  if (factor < 2) {
    const gap = luck < 0 ? factor - 1 : 1 - 1 / factor;
    return luck < 0
      ? `about ${roughPercent(gap)} more words standing than`
      : `about ${roughPercent(gap)} fewer words standing than`;
  }

  // Past the ladder, a named multiple would be an understatement dressed as a
  // measurement: an eighth reported as "about a fifth" is simply wrong.
  const step = Math.round(factor) - 2;
  if (step >= MULTIPLES.length) {
    return luck < 0
      ? 'several times as many words standing as'
      : 'a small fraction of the words';
  }

  return luck < 0
    ? `about ${MULTIPLES[step]} as many words standing as`
    : `about ${FRACTIONS_OF[step]} as many words standing as`;
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
 * Classifies candidate likelihood into bands (e.g. top, strong, plausible, outside, low-probability).
 * Uses coarse bands to describe position intuitively without revealing the answer list cutoff.
 */
const LIKELIEST = 0.02;
const NEAR_THE_TOP = 0.15;
const MIDDLING = 0.35;
const WELL_DOWN = 0.55;

function placeOnTheList(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();

  if (row.standing <= LIKELIEST) return `${word} was the top candidate among words that fit the clues`;
  if (row.standing < NEAR_THE_TOP) return `${word} was a strong candidate among words that fit the clues`;
  if (row.standing < MIDDLING) return `${word} was a plausible candidate among words that fit the clues`;
  if (row.standing < WELL_DOWN) return `${word} was an outside candidate among words that fit the clues`;
  return `${word} was a low-probability candidate among words that fit the clues`;
}

/** The placement, and what it made the guess, in plain English. */
function standingOnTheList(row: GuessToExplain): string {
  const placed = placeOnTheList(row);

  if (row.standing < NEAR_THE_TOP) return `${placed}, aiming to solve the puzzle directly`;
  if (row.standing >= WELL_DOWN) {
    return `${placed} — an exploratory probe to test letters rather than a direct shot at the answer`;
  }
  return placed;
}

function skillStory(row: GuessToExplain): string {
  const word = row.guess.toUpperCase();

  if (row.skill === null) {
    return (
      `Not scored ${DASH} openers are not scored for skill. An opener's value is reflected in par instead, ` +
      'through the board position it leaves you.'
    );
  }

  const score = percent(row.skill);

  if (row.weight === 0) {
    return row.skill >= ROUNDS_TO_FULL_MARKS
      ? `Skill ${score} ${DASH} The clues had narrowed to one word, and ${word} was it. It counts ` +
          'for none of the skill average either way.'
      : `Skill ${score} ${DASH} ${placeOnTheList(row)}, and by then the clues had settled on the ` +
          'top candidate. It counts for none of the skill average either way.';
  }

  if (row.forced) {
    return (
      `Skill ${score} ${DASH} ${placeOnTheList(row)}, and the position offered no real alternative: ` +
      'nothing available would have finished sooner.'
    );
  }

  const surprising = row.standing >= WELL_DOWN && row.skill >= NEAR_BEST;
  const connector = surprising ? 'Despite being an exploratory move, i' : 'I';

  if (row.skill >= ROUNDS_TO_FULL_MARKS) {
    return (
      `Skill ${score} ${DASH} ${standingOnTheList(row)}. ` +
      `${surprising ? 'Despite being an exploratory move, no' : 'No'} available move would have solved the puzzle in fewer turns.`
    );
  }
  if (row.skill >= NEAR_BEST) {
    return `Skill ${score} ${DASH} ${standingOnTheList(row)}. ${connector}t was close to the fastest mathematical path to the answer.`;
  }

  const risk =
    row.likeliestOutcomeShare >= NOTABLE_RISK
      ? ` Even with favorable feedback, it would still leave ${fieldShare(row.likeliestOutcomeShare)} of remaining candidate words untested.`
      : '';
  const despite = row.standing < NEAR_THE_TOP ? 'even as a direct attempt, it' : 'from this position, it';

  return (
    `Skill ${score} ${DASH} ${standingOnTheList(row)}.${risk} ` +
    `${despite.charAt(0).toUpperCase()}${despite.slice(1)} averaged ${moreTurns(row.skill)} the best play available.`
  );
}

function luckStory(row: GuessToExplain, won: boolean): string {
  const word = row.guess.toUpperCase();

  if (row.skill !== null && row.weight === 0) {
    return `Luck ${bits(row.luck)} ${DASH} Only one candidate remained, so tile feedback had no uncertainty left to resolve.`;
  }

  if (won) {
    return (
      `Luck ${bits(row.luck)} ${DASH} Solved! ${word} was the answer, clearing away all remaining possibilities instantly.`
    );
  }

  if (Math.abs(row.luck) <= LUCK_NOTICEABLE) {
    return `Luck ${bits(row.luck)} ${DASH} Expected feedback: the tiles eliminated about as many words as typical for ${word}.`;
  }

  if (row.outcomeShare >= row.likeliestOutcomeShare) {
    return (
      `Luck ${bits(row.luck)} ${DASH} You got unlucky: this feedback eliminated the fewest possible words, ` +
      `leaving ${fieldShare(row.outcomeShare)} of candidate words untested.`
    );
  }

  if (row.luck > 0) {
    return (
      `Luck ${bits(row.luck)} ${DASH} ${row.luck > 1 ? 'You got very lucky' : 'You got lucky'}: ` +
      `the feedback eliminated more possibilities than average, leaving ${sizeGap(row.luck)} typical.`
    );
  }

  return (
    `Luck ${bits(row.luck)} ${DASH} You got unlucky: the feedback left ${sizeGap(row.luck)} typical.`
  );
}

/**
 * Each scored guess's share of the skill average, as whole percentages that sum
 * to a hundred.
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
  const par = guesses(round.par ?? PAR);
  const charged = round.solved ? round.guessesUsed : UNSOLVED_GUESSES;
  const took = round.solved
    ? `You solved this round in ${round.guessesUsed} guesses.`
    : `This round did not solve the puzzle, which is charged at ${UNSOLVED_GUESSES} guesses.`;

  return (
    `Today's benchmark par is ${par} guesses (the average for expert play). ` +
    `${took} Every guess saved or spent adjusts your score by ${C_PAR} points: ` +
    `${C_PAR} ${TIMES} (${par} ${MINUS} ${charged}) = ${signedPoints(round.outcome)}.`
  );
}

function bonusStory(round: RoundToExplain): string {
  return round.starterBonus > 0
    ? `Starter bonus (+${points(round.starterBonus)} pts): awarded for accepting today's mystery house starter blind. ` +
        'The bonus rewards the risk of starting blind; manually typing the same word does not qualify.'
    : `None: this round used your own opener. The starter bonus is reserved for accepting the mystery house starter blind.`;
}

function totalStory(round: RoundToExplain): string {
  const sum = [
    points(round.skill),
    `${round.outcome < 0 ? MINUS : '+'} ${points(Math.abs(round.outcome))}`,
    ...(round.starterBonus > 0 ? [`+ ${points(round.starterBonus)}`] : []),
  ].join(' ');

  return (
    `Your total score combines deduction skill, par adjustment, and starter bonus: ` +
    `${sum} = ${points(round.total)}.`
  );
}

function explainZones(round: RoundToExplain): ExplainedZones {
  const dynamic = computeDynamicZones({
    maxScore: round.maxScore,
    par: round.par,
    starterBonus: round.starterBonus,
    guessesUsed: round.guessesUsed,
    totalScore: round.total,
  });

  const activeZone = zoneForScore(round.total, dynamic.zones);
  const par = guesses(round.par ?? PAR);

  // Order zones vertically from highest tier (Godlike) to lowest tier (Troll/Blind)
  const zones: ExplainedZoneThreshold[] = [...dynamic.zones].reverse().map((zone) => ({
    id: zone.id,
    label: zone.label,
    minScore: zone.minScore,
    maxScore: zone.maxScore,
    color: zone.color,
    isCurrent: zone.id === activeZone.id,
  }));

  let story: string;
  if (dynamic.isBlindLuck) {
    story =
      `Your score was Blind luck. A hole-in-one on guess 1 is pure lottery luck, so Par ` +
      `quarantines it in its own radiant gold tier rather than letting it distort the skill-based ` +
      `Godlike zone.`;
  } else if (dynamic.isBlind) {
    story =
      `Your score was Blind. When an unsolved round scores below 60.0, Par ` +
      `dynamically expands the meter floor so the score is displayed cleanly without overflowing.`;
  } else {
    story =
      `Your score was ${activeZone.label.toLowerCase()} (${activeZone.minScore.toFixed(1)} to ` +
      `${activeZone.maxScore.toFixed(1)} pts). The score meter is calibrated specifically for ` +
      `today's puzzle (benchmark par ${par}, strategic ceiling ${dynamic.meterMaxScore.toFixed(1)}). ` +
      `A score of ${dynamic.parScore.toFixed(0)} represents meeting par expectation with 100% skill, ` +
      `marking the boundary between Good and Ultra.`;
  }

  return {
    activeZone,
    parScore: dynamic.parScore,
    meterMinScore: dynamic.meterMinScore,
    meterMaxScore: dynamic.meterMaxScore,
    isBlind: dynamic.isBlind,
    isBlindLuck: dynamic.isBlindLuck,
    zones,
    story,
  };
}

export function explainRound(round: RoundToExplain): ExplainedRound {
  const scored = round.breakdown.filter(
    (row): row is GuessToExplain & { skill: number } => row.skill !== null,
  );
  const shares = skillShares(scored);
  const weighed = scored.some((row) => row.weight > 0);

  return {
    lead:
      `Par doesn't just count how many guesses you took ${DASH} it scores how well you reasoned ` +
      `through each position before the tiles turned over. Each guess is judged against the ` +
      `quickest path to the answer, whether you aimed directly at a likely solution or played an ` +
      `exploratory word to eliminate possibilities. Luck shows whether you got lucky or unlucky ` +
      `with tile reveals, and never affects your total score.`,

    guesses: round.breakdown.map((row, index) => ({
      turn: row.turn,
      guess: row.guess,
      skillStory: skillStory(row),
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
    zones: explainZones(round),
  };
}
