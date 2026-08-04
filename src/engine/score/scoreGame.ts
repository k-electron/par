/**
 * Scoring a whole game.
 *
 * ```
 * Skill   = Σ_{i ≥ 2, |S_i| ≥ 2} w_i · s_i / Σ w_i      w_i = log2 |S_i|
 *           (Skill = 100 if there are no such guesses)
 * Outcome = C_PAR × (PAR − min(n, 7))
 * Total   = Skill + Outcome + (took the house starter ? EPSILON : 0)
 * ```
 *
 * Guess 1 is never skill-scored, under either opener path. Opener choice
 * expresses itself only through the position it creates, which the outcome term
 * prices at fair odds — that is what makes a lucky custom opener legitimate
 * rather than an exploit, and it is why the bold random opener is not punished
 * twice.
 *
 * The luck figure is computed for every guess including the first, because
 * "your random opener ran hot today" is the honest explanation for a fast
 * finish. It is display only and never reaches a total.
 */

import { C_PAR, EPSILON, PAR, UNSOLVED_GUESSES } from '../config/constants';
import { log2 } from '../numeric/log2';
import { luckBits } from '../numeric/information';
import { patternCounts } from '../words/filter';
import { WIN_PATTERN, computePattern } from '../words/pattern';
import type { Observation } from '../words/filter';
import type { PositionScorer } from './scoreGuess';

/**
 * Guess count to points. **The only place this conversion happens.**
 *
 * Spec §3 requires exactly one, so the outcome term cannot drift away from
 * being linear in guess count. Linearity is what makes expected points a
 * straight function of expected guesses, so luck pays at exactly fair odds and
 * no gamble beats good play on average. A convex payout — a jackpot for
 * finishing in two — would pay for variance itself, and variance is free:
 * anyone can manufacture it by guessing recklessly.
 *
 * Celebrate fast finishes with a badge. Never with points.
 */
export function outcomePoints(guessesUsed: number, solved: boolean): number {
  const effective = solved ? Math.min(guessesUsed, UNSOLVED_GUESSES) : UNSOLVED_GUESSES;
  return C_PAR * (PAR - effective);
}

export interface GuessBreakdown {
  /** 1-based, the way a player counts their guesses. */
  readonly turn: number;
  readonly guess: string;
  readonly pattern: number;
  /** Candidates alive *before* this guess. */
  readonly candidateCount: number;
  /**
   * Candidates still alive *after* the feedback came back. Display only.
   *
   * Already computed here for the luck figure, and kept because the results
   * table needs it: a row that reports only the count going in describes the
   * guess before it rather than itself, and the reader has to look down a line
   * to find out what their guess actually achieved.
   */
  readonly remainingCount: number;
  /** `s_i`, or null when the guess is not skill-scored. */
  readonly skill: number | null;
  /** Its share of the skill average, `log2 |S_i|`. Zero when unscored. */
  readonly weight: number;
  /** Realized minus expected bits. Positive means lucky. Display only. */
  readonly luck: number;
  /** The position offered no real choice, so the score was unavoidable. */
  readonly forced: boolean;
}

export interface GameScore {
  readonly skill: number;
  readonly outcome: number;
  readonly starterBonus: number;
  readonly total: number;
  readonly guessesUsed: number;
  readonly solved: boolean;
  readonly breakdown: readonly GuessBreakdown[];
}

export interface GameToScore {
  readonly guesses: readonly string[];
  readonly answer: string;
  /**
   * Whether the player accepted the house starter.
   *
   * Spec §6: the bonus is for accepting the blind commitment, so it attaches to
   * the toggle and not to the word. A player who declined and then happened to
   * type the same word as their own opener earns nothing — the obvious
   * implementation, comparing guess one against the day's starter, would pay
   * exactly the bookmark habit the bonus exists to tax.
   */
  readonly tookHouseStarter: boolean;
}

export function scoreGame(game: GameToScore, scorer: PositionScorer): GameScore {
  const { guesses, answer, tookHouseStarter } = game;
  if (guesses.length === 0) {
    throw new RangeError('A game with no guesses cannot be scored.');
  }

  const history: Observation[] = [];
  const breakdown: GuessBreakdown[] = [];

  let weightedSkill = 0;
  let totalWeight = 0;
  let solved = false;

  for (let index = 0; index < guesses.length; index += 1) {
    const guess = guesses[index]!;
    const before = scorer.candidatesAfter(history);
    const candidateCount = before.length;

    // Every guess but the first is scored, including one facing a single
    // candidate. Spec §3 is explicit that such a guess "scores 100 — but its
    // aggregation weight is log2(1) = 0, so it contributes nothing to the
    // average either way", and that distinction is visible: skipping it entirely
    // leaves the last row of most solved games with no score to show, which is
    // not the same as showing the 100 it earned.
    //
    // Weighting it zero rather than filtering it is exactly equivalent
    // arithmetically, which is why the spec's `|S_i| ≥ 2` filter and this loop
    // agree on `Skill` while disagreeing on what there is to report.
    const scored = index >= 1;
    const assessment = scored ? scorer.scoreGuess(history, guess) : null;
    const weight = scored ? log2(candidateCount) : 0;

    if (assessment !== null) {
      weightedSkill += weight * assessment.skill;
      totalWeight += weight;
    }

    const pattern = computePattern(guess, answer);
    history.push({ guess, pattern });
    const remaining = scorer.candidatesAfter(history).length;

    breakdown.push({
      turn: index + 1,
      guess,
      pattern,
      candidateCount,
      remainingCount: remaining,
      skill: assessment?.skill ?? null,
      weight,
      // Shown for guess 1 too: it is the honest explanation for a fast finish,
      // and never a grade on the opener choice.
      luck: remaining > 0 ? luckBits(patternCounts(guess, before), candidateCount, remaining) : 0,
      forced: assessment?.forced ?? false,
    });

    if (pattern === WIN_PATTERN) {
      solved = true;
      break;
    }
  }

  // Spec §3: Skill is 100 when no guess qualified. Without this, every
  // two-guess solve whose opener left a single candidate divides by zero.
  //
  // The clamp is not a fudge. Every `s_i` is at most 100, so their weighted
  // mean is mathematically at most 100 too; a hard-mode game of nothing but
  // forced moves sums exact hundreds and can still land on 100.00000000000003
  // once the division rounds. Spec §3 fixes the range as (0, 100], and
  // "played at 100.00000000000003%" is not a number to show anybody.
  const mean = totalWeight > 0 ? weightedSkill / totalWeight : 100;
  const skill = mean > 100 ? 100 : mean;

  const guessesUsed = breakdown.length;
  const outcome = outcomePoints(guessesUsed, solved);
  const starterBonus = tookHouseStarter ? EPSILON : 0;

  return {
    skill,
    outcome,
    starterBonus,
    total: skill + outcome + starterBonus,
    guessesUsed,
    solved,
    breakdown,
  };
}
