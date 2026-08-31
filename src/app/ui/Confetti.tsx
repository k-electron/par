import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';

/**
 * A win, celebrated.
 *
 * Rendered once the last tile has landed on a solved board, and only on the
 * player's own game — a shared result is somebody else's win, and throwing
 * confetti at a reader who did not earn it is noise.
 */

/**
 * The bang, then the fall.
 *
 * One keyframe rather than one per piece: where a piece is thrown arrives as
 * custom properties set on the element, so sixty pieces share a single
 * animation and the stylesheet does not grow with the count.
 *
 * The two halves are eased in opposite directions, which is the whole
 * difference between a popper and a snowfall. Out of the barrel the piece
 * decelerates — it leaves fast and runs out of push. After that gravity has it,
 * so the drop accelerates while the piece fades. A single easing across both
 * would read as drifting.
 */
const burst = keyframes`
  0% {
    transform: translate(0, 0) rotate(0deg) scale(0.6);
    opacity: 1;
    animation-timing-function: cubic-bezier(0.12, 0.8, 0.3, 1);
  }
  55% {
    transform: translate(var(--dx), var(--dy)) rotate(var(--spin)) scale(1);
    opacity: 1;
    animation-timing-function: cubic-bezier(0.45, 0, 0.9, 0.55);
  }
  100% {
    transform:
      translate(calc(var(--dx) * 1.15), calc(var(--dy) + 60vh))
      rotate(calc(var(--spin) * 2))
      scale(1);
    opacity: 0;
  }
`;

const PIECES = 60;

/**
 * Spread derived from the index rather than drawn at random.
 *
 * The component re-renders while the results settle, and random values would be
 * redrawn each time — pieces teleporting mid-flight. Index arithmetic gives the
 * same throw every render for free. The steps are chosen to share no factor with
 * the count, so angle, distance and spin do not fall into step with each other
 * and stripe the burst.
 */
const scatter = (index: number, step: number) => ((index * step) % PIECES) / PIECES;

/**
 * Two poppers in the bottom corners, firing across each other.
 *
 * Corners rather than one burst from the middle: the results land in the centre
 * of the screen the moment the board settles, and a centre burst throws its
 * densest, slowest pieces over the score the player is trying to read.
 *
 * The cone is measured up from the horizon, so `spread` is how wide the barrel
 * throws either side of `aim`.
 */
const POPPERS = [
  { x: '8%', aim: 62, flip: 1 },
  { x: '92%', aim: 62, flip: -1 },
] as const;

const CONE = 34;

interface Piece {
  readonly dx: string;
  readonly dy: string;
  readonly spin: string;
  readonly size: number;
  readonly round: boolean;
}

/**
 * Where one piece is thrown.
 *
 * Computed once at module load, not per render — the values only depend on the
 * index, so recomputing them sixty times a render would buy nothing.
 */
function throwPiece(index: number, aim: number, flip: number): Piece {
  const angle = aim + (scatter(index, 13) - 0.5) * CONE;
  // Short throws and long throws in the same burst; an even spread of distance
  // reads as a ring rather than a spray.
  const distance = 26 + scatter(index, 23) * 62;
  const radians = (angle * Math.PI) / 180;

  return {
    dx: `${(Math.cos(radians) * distance * flip).toFixed(1)}vmin`,
    // Screen coordinates run down, the throw goes up.
    dy: `${(-Math.sin(radians) * distance).toFixed(1)}vmin`,
    spin: `${Math.round((scatter(index, 19) - 0.5) * 900)}deg`,
    size: 6 + Math.round(scatter(index, 29) * 5),
    round: index % 5 === 0,
  };
}

const THROWS = POPPERS.map((popper) =>
  Array.from({ length: PIECES }, (_, index) => throwPiece(index, popper.aim, popper.flip)),
);

export function Confetti() {
  const { tiles, palette } = useTheme();
  const colors = [tiles.correct, tiles.present, palette.primary.main];

  return (
    <Box
      aria-hidden
      data-testid="confetti"
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: (theme) => theme.zIndex.modal - 1,
      }}
    >
      {POPPERS.map((popper, barrel) => (
        <Box key={barrel} sx={{ position: 'absolute', left: popper.x, bottom: '18%' }}>
          {THROWS[barrel]!.map((piece, index) => (
            <Box
              key={index}
              style={
                {
                  '--dx': piece.dx,
                  '--dy': piece.dy,
                  '--spin': piece.spin,
                } as React.CSSProperties
              }
              sx={{
                position: 'absolute',
                width: piece.size,
                height: piece.round ? piece.size : piece.size * 1.6,
                borderRadius: piece.round ? '50%' : '1px',
                backgroundColor: colors[index % colors.length],
                // The bang is one event, so the pieces leave together. The few
                // milliseconds of spread are the barrel emptying, not a queue.
                animation: `${burst} ${1.5 + scatter(index, 23) * 0.9}s ${
                  scatter(index, 7) * 0.09
                }s forwards`,
              }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
