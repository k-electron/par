/**
 * How long a row takes to turn over.
 *
 * The reveal is the one place the game deliberately makes the player wait, so
 * the numbers are here with their trade written down rather than inlined in a
 * component.
 *
 * The duration is also *derived* here. Two things depend on it — the CSS that
 * staggers the tiles, and the timer that decides when the score may appear — and
 * if they computed it separately they would eventually disagree, which shows up
 * as a score landing over a tile still mid-flip.
 */

import { WORD_LENGTH } from '../../engine/words/letters';

export interface RevealTiming {
  /** Delay between one tile starting to turn and the next. */
  readonly stagger: number;
  /** How long a single tile takes to turn over. */
  readonly flip: number;
}

/**
 * The shipped feel.
 *
 * **This trades suspense against getting on with it.** Longer and the round
 * acquires drama; longer still and a player typing quickly is waiting on the
 * board. At these values five tiles take a little over a second, which is close
 * to the game this borrows the idea from.
 *
 * `flip` is the visible turn; `stagger` is slightly shorter so a tile begins
 * before its neighbour has finished, which reads as a ripple rather than as six
 * separate events.
 */
export const REVEAL: RevealTiming = { stagger: 260, flip: 300 };

/**
 * No wait at all.
 *
 * Used under a reduced-motion preference, and by tests that are about something
 * other than the animation. Zero rather than nearly-zero, so a test asserting
 * what happens "after the reveal" needs no timer at all.
 */
export const INSTANT_REVEAL: RevealTiming = { stagger: 0, flip: 0 };

/**
 * How long until the last tile has finished turning.
 *
 * The final tile starts after every earlier one has been staggered past it, then
 * takes a full flip of its own.
 */
export function revealDuration(timing: RevealTiming): number {
  return (WORD_LENGTH - 1) * timing.stagger + timing.flip;
}
