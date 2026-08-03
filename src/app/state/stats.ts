/**
 * Personal statistics from retained days.
 *
 * **The average over time is the point.** A single day is meant to be spiky:
 * the reckless gambler who catches three greens should top the board that day,
 * and over many days should not. That balance only reads as honest if a player
 * can see their own average, which is why this exists rather than being an extra.
 *
 * The streak is included because people like it, and deliberately not the
 * headline. It measures showing up, not playing well.
 */

import { MAX_GUESSES } from '../../engine/config/constants';
import type { DayRecord } from '../storage/repository';

export interface PlayerStats {
  readonly played: number;
  readonly solved: number;
  /** Solved as a percentage of played, or null with nothing to divide. */
  readonly solveRate: number | null;
  readonly averageTotal: number | null;
  readonly averageSkill: number | null;
  readonly averageGuesses: number | null;
  /** Count of solves by guess count, index 0 meaning one guess. */
  readonly distribution: readonly number[];
  readonly currentStreak: number;
  readonly bestStreak: number;
}

/** A finished day with a score attached, which is what stats are built from. */
export interface ScoredDay {
  readonly puzzleNumber: number;
  readonly solved: boolean;
  readonly guessesUsed: number;
  readonly total: number;
  readonly skill: number;
}

export const EMPTY_STATS: PlayerStats = {
  played: 0,
  solved: 0,
  solveRate: null,
  averageTotal: null,
  averageSkill: null,
  averageGuesses: null,
  distribution: Array.from({ length: MAX_GUESSES }, () => 0),
  currentStreak: 0,
  bestStreak: 0,
};

/** Days a stats view can use: finished, and in ascending day order. */
export function completedDays(history: readonly DayRecord[]): readonly DayRecord[] {
  return history
    .filter((record) => record.status !== 'playing')
    .slice()
    .sort((a, b) => a.puzzleNumber - b.puzzleNumber);
}

export function summarise(days: readonly ScoredDay[]): PlayerStats {
  if (days.length === 0) return EMPTY_STATS;

  const ordered = days.slice().sort((a, b) => a.puzzleNumber - b.puzzleNumber);
  const distribution = Array.from({ length: MAX_GUESSES }, () => 0);

  let solved = 0;
  let totalSum = 0;
  let skillSum = 0;
  let guessSum = 0;

  for (const day of ordered) {
    totalSum += day.total;
    skillSum += day.skill;
    if (day.solved) {
      solved += 1;
      guessSum += day.guessesUsed;
      const slot = day.guessesUsed - 1;
      if (slot >= 0 && slot < distribution.length) {
        distribution[slot] = (distribution[slot] ?? 0) + 1;
      }
    }
  }

  const { current, best } = streaks(ordered);

  return {
    played: ordered.length,
    solved,
    solveRate: (100 * solved) / ordered.length,
    averageTotal: totalSum / ordered.length,
    averageSkill: skillSum / ordered.length,
    averageGuesses: solved > 0 ? guessSum / solved : null,
    distribution,
    currentStreak: current,
    bestStreak: best,
  };
}

/**
 * Consecutive solved days.
 *
 * A streak needs consecutive *puzzle numbers*, not merely consecutive records:
 * skipping a day and solving the next one starts over, which is what a streak
 * means to the person counting it.
 */
function streaks(ordered: readonly ScoredDay[]): { current: number; best: number } {
  let current = 0;
  let best = 0;
  let previousDay: number | null = null;

  for (const day of ordered) {
    if (!day.solved) {
      current = 0;
    } else if (previousDay !== null && day.puzzleNumber === previousDay + 1) {
      current += 1;
    } else {
      current = 1;
    }

    if (current > best) best = current;
    previousDay = day.puzzleNumber;
  }

  return { current, best };
}
