/**
 * One-step information, in bits.
 *
 * Spec §3 ranks legal guesses "by one-step expected information descending",
 * which is what selects the guesses the search explores. Spec §3 also asks for a
 * display-only luck stat — "realized information minus expected information" —
 * and decision 0001 records that the same private `log2` serves both, so the
 * two halves of that figure live here next to the ranking's own measure rather
 * than being rebuilt somewhere that might reach for `Math.log2`.
 *
 * Partitions arrive as dense count tables indexed by pattern, so they are
 * accumulated in ascending pattern order on every machine. Empty patterns
 * contribute nothing and are skipped, which is spec §3's first guard clause:
 * a `0 × V(∅)` term must never become NaN.
 */

import { log2 } from './log2';

/**
 * The expected number of bits a guess reveals, given how it partitions a
 * candidate set of `total` words.
 *
 * `H = (1 / total) Σ n_p log2 (total / n_p)`, summed over the patterns that
 * actually occur. Written that way rather than as
 * `log2 total − (1 / total) Σ n_p log2 n_p`, because the two logarithms in that
 * subtraction cancel: a guess that barely narrows the field would lose most of
 * its significant digits, and one that narrows nothing could come back as a
 * small negative. Every term of this form is instead non-negative on its own,
 * and a guess that separates nothing reports exactly zero.
 */
export function expectedInformationBits(counts: ArrayLike<number>, total: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new RangeError(`Not a candidate count: ${total}`);
  }

  let weighted = 0;
  for (let pattern = 0; pattern < counts.length; pattern += 1) {
    const count = counts[pattern] ?? 0;
    if (count > 0) {
      weighted += count * log2(total / count);
    }
  }

  return weighted / total;
}

/**
 * The bits a guess actually revealed: the candidate set went from `total` words
 * to `remaining`.
 *
 * The same shape as one term of the expectation above, so that the luck figure
 * subtracts like quantities. A field that halved reports exactly one bit however
 * odd the counts are, and one that did not narrow at all reports exactly zero.
 */
export function realizedInformationBits(total: number, remaining: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new RangeError(`Not a candidate count: ${total}`);
  }
  if (!Number.isInteger(remaining) || remaining <= 0 || remaining > total) {
    throw new RangeError(`Not a surviving count out of ${total}: ${remaining}`);
  }

  return log2(total / remaining);
}

/**
 * How the feedback broke relative to expectation. Positive means lucky.
 *
 * Display only. Spec §3 is explicit that this must never enter a total, and
 * philosophy position 1 is why: a realized outcome cannot be allowed to reach
 * the skill score. It is kept apart from `scoreGuess` by signature — this one
 * needs to know what actually happened, and that one cannot be told.
 */
export function luckBits(
  counts: ArrayLike<number>,
  total: number,
  remaining: number,
): number {
  return realizedInformationBits(total, remaining) - expectedInformationBits(counts, total);
}
