/**
 * The tunable constants, and what each one trades.
 *
 * They live together because they are the knobs someone will reach for, and a
 * knob without its trade-off written next to it gets turned for the wrong
 * reason. Spec §3 says to use these values; the validated ranges say how far
 * they may move if one has to.
 */

import { GENERATED_PAR, GENERATED_PAR_V1, GENERATED_PAR_V2 } from './par.generated';

/**
 * Points per guess relative to par.
 *
 * **This is the knob that trades daily drama against long-run fidelity.**
 * Raise it and single days get spikier and luckier; lower it and skill
 * dominates but daily results flatten into sameness. The shipped value puts a
 * lucky finish comfortably ahead of a disciplined one on the day while leaving
 * the long-run ordering intact.
 *
 * Validated across [3, 5]. Inside that range is known-safe; outside is not.
 */
export const C_PAR = 4;

/**
 * The house-starter bonus.
 *
 * Sized to cover the small gap between a player's favourite opener and a random
 * decent one — enough that taking the shared starter is the mildly better
 * habit, not so much that collecting it and then ignoring the clues pays.
 *
 * Validated across [2, 4]. The window is wide on both sides; this is not a
 * delicate number.
 */
export const EPSILON = 3;

/**
 * The mean guess count for strong play opening from house starters.
 *
 * Deliberately not average-human play: if par were the average result, half the
 * field would be under par on any given day and the phrase would mean nothing.
 * Most players sit over par most days, and that is the honest baseline.
 *
 * A constant offset that cancels when two people compare the same day, so its
 * job is to keep totals near 100 and make the golf framing mean something.
 * Derived from the word lists, so it is regenerated with them — see
 * `npm run compute-par` and docs/scoring.md.
 *
 * One global constant, never per-mode. Hard-mode players sit slightly over par
 * for equivalent decision quality and that is accepted: inflating one mode to
 * compensate would muddy what the number means. The share badge says which mode
 * was played.
 */
export const PAR_V1 = GENERATED_PAR_V1;
export const PAR_V2 = GENERATED_PAR_V2;
export const PAR = GENERATED_PAR;

/**
 * Word selection v2 cutover day.
 * Puzzles before this day draw from the legacy 3,000-word answer list.
 * Puzzles from this day onwards use weighted selection over the 9,570-word v2 candidate list.
 */
export const CUTOVER_PUZZLE_NUMBER = 260;

/** Return the appropriate PAR value for a given puzzle number (cutover at CUTOVER_PUZZLE_NUMBER). */
export function parFor(puzzleNumber?: number): number {
  if (puzzleNumber !== undefined && puzzleNumber >= CUTOVER_PUZZLE_NUMBER) {
    return PAR_V2;
  }
  return PAR_V1;
}

/** An unsolved game is priced as this many guesses. */
export const UNSOLVED_GUESSES = 7;

/**
 * The skill percentage at which a solved round is badged clean.
 *
 * **This knob trades how often the badge appears against what it means.** It is
 * cosmetic — no badge carries points, spec §7 — so the only cost of getting it
 * wrong is the word losing its force. Set it too low and a clean round becomes
 * the default, which says nothing; too high and it becomes unreachable, which
 * says nothing either.
 *
 * 97 sits just above what an attentive player reaches by not wasting a turn,
 * and below the 100 that only fully optimal play earns — so it rewards playing
 * well without demanding perfection. Note that it is deliberately achievable on
 * a slow day: a five-guess solve at 100% is clean, because the badge grades
 * decisions and the outcome term already prices the guess count.
 *
 * Compare with `>=`, on the unrounded percentage. Skill is a computed float, and
 * a threshold written as `> 96.99` would award the badge at 96.99999999999999.
 */
export const CLEAN_ROUND_SKILL = 97;

/**
 * The guess count at or under which a solved round is badged quick.
 *
 * Cosmetic, like every badge. Sits just under `PAR` so the badge marks beating
 * the baseline rather than merely matching it, and the copy deliberately never
 * names the number — a two-guess solve badged "in three" reads like a bug.
 */
export const QUICK_ROUND_GUESSES = 3;

/** Guesses allowed in a game. */
export const MAX_GUESSES = 6;

/**
 * Identifies the scorer that produced a number, and travels in share links.
 *
 * Spec §5 requires payloads to carry this alongside the word-list version so a
 * replay built by a different scorer is flagged rather than silently showing a
 * different total. Silent divergence is the failure that priority 2 ranks second
 * only to being wrong.
 *
 * Version 1: Puzzles 0-259 with unweighted search and PAR 3.71.
 * Version 2: Puzzles 260+ with weighted search and PAR_V2.
 */
export const SCORER_VERSION_V1 = 1;
export const SCORER_VERSION_V2 = 2;
export const SCORER_VERSION = SCORER_VERSION_V1;

/** Return the expected scorer version for a given puzzle number (cutover at CUTOVER_PUZZLE_NUMBER). */
export function scorerVersionFor(puzzleNumber?: number): number {
  if (puzzleNumber !== undefined && puzzleNumber >= CUTOVER_PUZZLE_NUMBER) {
    return SCORER_VERSION_V2;
  }
  return SCORER_VERSION_V1;
}
