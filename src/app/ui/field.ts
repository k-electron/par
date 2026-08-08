/**
 * How much of the field a row's bar draws as still standing.
 *
 * Logarithmic, not linear. A linear bar would be all but empty from the second
 * row onward — a decent opener leaves a few per cent of the field alive, and
 * every later row would sit at a width the eye cannot separate from the one
 * below it. On a log scale an equal cut shortens the bar by an equal amount, so
 * the column reads as a field collapsing at a rate rather than as one row of
 * interest followed by five slivers.
 *
 * It reaches exactly zero when one word remains, which is what lets the column
 * tell the round's story without a number in it: the bar empties as the answer
 * is pinned down, and a round that ended with the field still wide ends with a
 * bar still visibly drawn.
 *
 * `Math.log2` is deliberate here and not a determinism lapse. The engine is
 * forbidden it because a last-bit difference there can change which guesses the
 * search explores and move a score (see `docs/determinism.md`); this is a CSS
 * width, where the same difference is a fraction of a pixel and cannot change a
 * word on screen. Every phrase beside the bar is decided by integer comparison
 * in `src/app/copy/results.ts` for exactly that reason.
 */
export function fieldFill(remaining: number, start: number): number {
  // A field that began at one word has no range to draw against, and would
  // divide by zero. Nothing can survive such a position either, so draw none.
  if (start <= 1) return 0;
  const fill = Math.log2(remaining) / Math.log2(start);
  return Math.min(1, Math.max(0, fill));
}
