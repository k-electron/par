import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';

/**
 * A win, celebrated.
 *
 * Rendered once the last tile has landed on a solved board, and only on the
 * player's own game — a shared result is somebody else's win, and throwing
 * confetti at a reader who did not earn it is noise.
 */

const fall = keyframes`
  0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
`;

const PIECES = 40;

/**
 * Spread derived from the index rather than drawn at random.
 *
 * The component re-renders while the results settle, and random values would be
 * redrawn each time — pieces teleporting mid-fall. Index arithmetic gives the
 * same scatter every render for free. The multipliers are coprime-ish with the
 * count so left, delay and drift do not fall into step with each other.
 */
const scatter = (index: number, step: number, spread: number) =>
  ((index * step) % PIECES) / PIECES * spread;

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
      {Array.from({ length: PIECES }, (_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: 0,
            left: `${scatter(i, 17, 100)}%`,
            width: 8,
            height: 14,
            borderRadius: '2px',
            backgroundColor: colors[i % colors.length],
            animation: `${fall} ${2.4 + scatter(i, 11, 1.4)}s ease-in ${scatter(i, 7, 1.2)}s forwards`,
          }}
        />
      ))}
    </Box>
  );
}
