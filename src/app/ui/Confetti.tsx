import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState } from 'react';

/**
 * A win, celebrated.
 *
 * Rendered once the last tile has landed on a solved board, and only on the
 * player's own game — a shared result is somebody else's win, and throwing
 * confetti at a reader who did not earn it is noise. Reduced motion is decided
 * by the caller, which simply does not render this.
 */

/**
 * Two cannons in the bottom corners, firing across each other.
 *
 * Corners rather than one burst from the middle: the results land in the centre
 * of the screen the moment the board settles, and a centre burst throws its
 * densest, slowest pieces over the score the player is trying to read.
 *
 * `angle` is measured anticlockwise from east, so 60 and 120 are a matched pair
 * aimed up and inward.
 */
const CANNONS = [
  { angle: 60, origin: { x: 0.02, y: 0.78 } },
  { angle: 120, origin: { x: 0.98, y: 0.78 } },
] as const;

export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { tiles, palette } = useTheme();

  // Captured at mount rather than read each render, so switching theme
  // mid-flight cannot re-run the effect and fire the cannons a second time.
  const [colors] = useState(() => [tiles.correct, tiles.present, palette.primary.main]);

  useEffect(() => {
    if (canvas.current === null) return;

    // A canvas without a 2d context — disabled in the browser, or a test
    // environment that does not implement one — has nothing to draw on. The
    // library assumes it got one and crashes on the first frame otherwise, and
    // a decoration must not take the board down with it.
    if (canvas.current.getContext('2d') === null) return;

    /**
     * Confined to our own canvas rather than the global one.
     *
     * The default export appends a canvas to `document.body` and keeps it for
     * the life of the page. Scoping the instance means the celebration is torn
     * down with the component — React owns the element, and `reset` stops the
     * animation — instead of outliving the screen that ordered it.
     */
    const fire = confetti.create(canvas.current, { resize: true });

    for (const cannon of CANNONS) {
      // Wider spread and a longer life than the defaults, which are tuned for a
      // small pop. `startVelocity` has to clear the corner it is fired from.
      void fire({
        particleCount: 90,
        startVelocity: 55,
        spread: 70,
        ticks: 260,
        scalar: 0.9,
        colors,
        ...cannon,
      });
    }

    return () => {
      void fire.reset();
    };
  }, [colors]);

  return (
    <Box
      aria-hidden
      data-testid="confetti"
      component="canvas"
      ref={canvas}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: (theme) => theme.zIndex.modal - 1,
      }}
    />
  );
}
