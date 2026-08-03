/**
 * The tunable constants, and what each one trades.
 *
 * They live together because they are the knobs someone will reach for, and a
 * knob without its trade-off written next to it gets turned for the wrong
 * reason. Spec §3 says to use these values; the validated ranges say how far
 * they may move if one has to.
 */

import { GENERATED_PAR } from './par.generated';

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
export const PAR = GENERATED_PAR;

/** An unsolved game is priced as this many guesses. */
export const UNSOLVED_GUESSES = 7;

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
 * **Bump this whenever anything that can move a score changes.** That includes:
 *
 * - the search bands in `search/policy.ts`, or the endgame shortcut
 * - the ranking key or any accumulation order in `search/value.ts`
 * - `SERIES_TERMS` or anything else in `numeric/log2.ts`
 * - `C_PAR`, `EPSILON`, or a regenerated `PAR`
 * - the aggregation or the outcome term in `score/scoreGame.ts`
 *
 * Regenerating the word lists does **not** need a bump: that already changes
 * `WORD_LIST_VERSION`, which is stamped separately.
 */
export const SCORER_VERSION = 1;
