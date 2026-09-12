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
 * Guess 1 is excluded from skill scoring since opener value is priced fairly through
 * the outcome term. Luck is tracked on all guesses for display only.
 */

import { C_PAR, EPSILON, PAR, UNSOLVED_GUESSES } from '../config/constants';
import { log2 } from '../numeric/log2';
import { luckBits } from '../numeric/information';
import { WIN_PATTERN, computePattern } from '../words/pattern';
import type { Observation } from '../words/filter';
import { partitionCandidateWeights, type PositionScorer } from './scoreGuess';

/**
 * Linear conversion of guess count to points.
 * Linearity ensures expected points directly reflect expected guesses at fair odds
 * without rewarding high-variance gambles.
 */
export function outcomePoints(guessesUsed: number, solved: boolean, par: number = PAR): number {
  const effective = solved ? Math.min(guessesUsed, UNSOLVED_GUESSES) : UNSOLVED_GUESSES;
  return C_PAR * (par - effective);
}

export interface GuessBreakdown {
  /** 1-based, the way a player counts their guesses. */
  readonly turn: number;
  readonly guess: string;
  readonly pattern: number;
  /** Candidates alive *before* this guess. */
  readonly candidateCount: number;
  /** Candidates still alive after feedback; display only for the results table. */
  readonly remainingCount: number;
  /** `s_i`, or null when the guess is not skill-scored. */
  readonly skill: number | null;
  /** Its share of the skill average, `log2 |S_i|`. Zero when unscored. */
  readonly weight: number;
  /** Realized minus expected bits. Positive means lucky. Display only. */
  readonly luck: number;
  /** The position offered no real choice, so the score was unavoidable. */
  readonly forced: boolean;
  /**
   * Relative standing among candidate words from commonest (0) to bottom (1).
   * Display only; distinguishes direct solution bets from exploratory probes.
   */
  readonly standing: number;
  /** Share of candidates left standing (`|S_i+1| / |S_i|`); expressed as a ratio to avoid exposing pool sizes. */
  readonly outcomeShare: number;
  /** The share the likeliest pattern would have left standing; measures worst-case risk before feedback. */
  readonly likeliestOutcomeShare: number;
}

export interface GameScore {
  readonly skill: number;
  readonly outcome: number;
  readonly starterBonus: number;
  readonly total: number;
  readonly guessesUsed: number;
  readonly solved: boolean;
  readonly breakdown: readonly GuessBreakdown[];
  readonly par?: number;
  readonly maxScore?: number;
}

export interface GameToScore {
  readonly guesses: readonly string[];
  readonly answer: string;
  /**
   * Whether the player accepted the house starter.
   * The bonus rewards accepting the blind commitment, so it attaches to the toggle rather than the word played.
   */
  readonly tookHouseStarter: boolean;
  /** The par value to score against. Defaults to PAR. */
  readonly par?: number;
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
    const beforeIndices = scorer.candidateIndicesAfter(history);
    const candidateCount = beforeIndices.length;
    // Read while `history` still holds only what was known when the guess was
    // played. The push below is what makes that a real hazard rather than a
    // note: every other display figure here is computed from `before`.
    const standing = scorer.standingOf(history, guess);

    // Scored guesses facing 1 candidate earn 100 with log2(1)=0 weight, displaying
    // the score without affecting the weighted average.
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

    // One histogram serves the luck figure and both display shares. It is the
    // partition the guess would have made of the position it faced, so
    // everything read off it describes the guess rather than the outcome — bar
    // `outcomeShare`, which is the outcome and says so.
    const { counts, totalCandidateWeight } = partitionCandidateWeights(
      scorer.lexicon,
      beforeIndices,
      guess,
    );

    const remainingWeight = counts[pattern]!;
    let likeliest = 0;
    for (const count of counts) {
      if (count > likeliest) {
        likeliest = count;
      }
    }

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
      luck: remainingWeight > 0 ? luckBits(counts, totalCandidateWeight, remainingWeight) : 0,
      forced: assessment?.forced ?? false,
      standing,
      outcomeShare: totalCandidateWeight > 0 ? remainingWeight / totalCandidateWeight : 0,
      likeliestOutcomeShare: totalCandidateWeight > 0 ? likeliest / totalCandidateWeight : 0,
    });

    if (pattern === WIN_PATTERN) {
      solved = true;
      break;
    }
  }

  // Defaults to 100 when no guesses qualify. Clamped to 100 to prevent floating-point rounding beyond 100%.
  const mean = totalWeight > 0 ? weightedSkill / totalWeight : 100;
  const skill = mean > 100 ? 100 : mean;

  const par = game.par ?? PAR;
  const guessesUsed = breakdown.length;
  const outcome = outcomePoints(guessesUsed, solved, par);
  const starterBonus = tookHouseStarter ? EPSILON : 0;

  let maxScore: number;
  if (tookHouseStarter) {
    if (guesses[0] === answer) {
      maxScore = 100 + outcomePoints(1, true, par) + starterBonus;
    } else {
      const p0 = computePattern(guesses[0]!, answer);
      const s2 = scorer.scoreGuess([{ guess: guesses[0]!, pattern: p0 }], answer).skill;
      maxScore = Math.max(
        s2 + outcomePoints(2, true, par) + starterBonus,
        100 + outcomePoints(3, true, par) + starterBonus,
      );
    }
  } else {
    maxScore = 100 + outcomePoints(2, true, par);
  }

  return {
    skill,
    outcome,
    starterBonus,
    total: skill + outcome + starterBonus,
    guessesUsed,
    solved,
    breakdown,
    par,
    maxScore,
  };
}
