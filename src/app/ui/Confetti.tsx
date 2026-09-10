import Box from '@mui/material/Box';
import Portal from '@mui/material/Portal';
import { useTheme } from '@mui/material/styles';
import confetti from 'canvas-confetti';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const { tiles, palette } = useTheme();

  const setCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node !== null) {
      setMounted(true);
    }
  }, []);

  // Captured at mount rather than read each render, so switching theme
  // mid-flight cannot re-run the effect and fire the cannons a second time.
  const [colors] = useState(() => [
    '#00FFA3',
    '#00F0FF',
    '#FFB800',
    '#FF007F',
    '#FFFFFF',
    tiles.correct,
    tiles.present,
    palette.primary.main,
  ]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;

    // A canvas without a 2d context — disabled in the browser, or a test
    // environment that does not implement one — has nothing to draw on. The
    // library assumes it got one and crashes on the first frame otherwise, and
    // a decoration must not take the board down with it.
    if (canvas.getContext('2d') === null) return;

    // Explicitly calibrate canvas internal dimensions to match viewport.
    if (typeof window !== 'undefined') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const onResize = () => {
      const activeCanvas = canvasRef.current;
      if (activeCanvas && typeof window !== 'undefined') {
        activeCanvas.width = window.innerWidth;
        activeCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', onResize);

    /**
     * Confined to our own canvas rather than the global one.
     *
     * The default export appends a canvas to `document.body` and keeps it for
     * the life of the page. Scoping the instance means the celebration is torn
     * down with the component — React owns the element, and `reset` stops the
     * animation — instead of outliving the screen that ordered it.
     */
    const fire = confetti.create(canvas, { resize: false });

    // 1. Central Supernova Starburst (FTL stellar jump)
    void fire({
      particleCount: 100,
      startVelocity: 48,
      spread: 360,
      ticks: 360,
      scalar: 1.35,
      shapes: ['star', 'circle'],
      colors,
      origin: { x: 0.5, y: 0.4 },
    });

    // 2. Twin Corner Plasma Cannons
    for (const cannon of CANNONS) {
      void fire({
        particleCount: 75,
        startVelocity: 65,
        spread: 75,
        ticks: 380,
        scalar: 1.2,
        shapes: ['star', 'circle'],
        colors,
        ...cannon,
      });
    }

    // 3. Secondary Starlight Shimmer Pulse
    const timer = setTimeout(() => {
      void fire({
        particleCount: 50,
        startVelocity: 35,
        spread: 360,
        ticks: 300,
        scalar: 1.1,
        shapes: ['star'],
        colors,
        origin: { x: 0.5, y: 0.45 },
      });
    }, 250);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      void fire.reset();
    };
  }, [mounted, colors]);

  return (
    <Portal>
      <Box
        aria-hidden
        data-testid="confetti"
        component="canvas"
        ref={setCanvas}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 1299,
        }}
        sx={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: (theme) => theme.zIndex.modal - 1,
        }}
      />
    </Portal>
  );
}

