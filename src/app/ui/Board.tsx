import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';

import { Tile } from '../../engine/words/pattern';
import { WORD_LENGTH } from '../state/gameSession';
import { REVEAL, type RevealTiming } from './reveal';

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
`;

const TILE_LABELS: Record<Tile, string> = {
  [Tile.Absent]: 'not in the word',
  [Tile.Present]: 'in the word, wrong place',
  [Tile.Correct]: 'correct',
};

export interface BoardRow {
  readonly letters: readonly string[];
  readonly tiles: readonly Tile[] | null;
}

export interface BoardProps {
  readonly rows: readonly BoardRow[];
  /** Which row is being typed into, or -1. Only that row shakes on rejection. */
  readonly activeRow: number;
  /** Changes on every rejection, which is what retriggers the animation. */
  readonly rejectionNonce: number;
  /**
   * The row currently turning over, or -1.
   *
   * Presentation only. The row's letters and tile states are already correct in
   * the markup before this animation runs, so nothing a screen reader or an
   * automated check reads is waiting on it.
   */
  readonly revealingRow?: number;
  readonly timing?: RevealTiming;
}

function describeRow(row: BoardRow): string | undefined {
  if (row.tiles === null) return undefined;
  return row.letters
    .map((letter, index) => `${letter.toUpperCase()} ${TILE_LABELS[row.tiles![index]!]}`)
    .join(', ');
}

interface TileLook {
  readonly bg: string;
  readonly border: string;
  readonly color: string;
}

/**
 * A tile turning over and landing on its colour.
 *
 * The colour changes at the halfway point, while the tile is edge-on and the
 * face is not readable — which is what sells the flip as the letter being
 * *turned over* rather than simply recoloured.
 *
 * Built per palette rather than written once, because both ends of the animation
 * are theme colours. A keyframe that left the landed colours unspecified would
 * be shorter but would interpolate from the element's own style, which is the
 * landed colour already, so the tile would fade rather than turn.
 */
function turnOver(idle: TileLook, landed: TileLook) {
  const face = (look: TileLook) => `
    background-color: ${look.bg};
    border-color: ${look.border};
    color: ${look.color};
  `;

  return keyframes`
    0%    { transform: rotateX(0deg);   ${face(idle)} }
    49.9% { transform: rotateX(-90deg); ${face(idle)} }
    50%   { transform: rotateX(-90deg); ${face(landed)} }
    100%  { transform: rotateX(0deg);   ${face(landed)} }
  `;
}

export function Board({
  rows,
  activeRow,
  rejectionNonce,
  revealingRow = -1,
  timing = REVEAL,
}: BoardProps) {
  const theme = useTheme();
  const { tiles } = theme;
  const tileStyles: Record<Tile, TileLook> = {
    [Tile.Absent]: { bg: tiles.absent, border: tiles.absent, color: tiles.text },
    [Tile.Present]: { bg: tiles.present, border: tiles.present, color: tiles.text },
    [Tile.Correct]: { bg: tiles.correct, border: tiles.correct, color: tiles.text },
  };

  // How a filled but unjudged tile looks: the state every revealing tile starts
  // from, so the row appears to be waiting its turn rather than already known.
  const unjudged: TileLook = {
    bg: 'transparent',
    border: tiles.filledBorder,
    color: theme.palette.text.primary,
  };

  const turning: Record<Tile, ReturnType<typeof keyframes>> = {
    [Tile.Absent]: turnOver(unjudged, tileStyles[Tile.Absent]),
    [Tile.Present]: turnOver(unjudged, tileStyles[Tile.Present]),
    [Tile.Correct]: turnOver(unjudged, tileStyles[Tile.Correct]),
  };

  return (
    <Box
      role="grid"
      aria-label="Guesses"
      sx={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows.length}, 1fr)`,
        gap: 0.75,
        width: '100%',
        maxWidth: 330,
        aspectRatio: `${WORD_LENGTH} / ${rows.length}`,
        mx: 'auto',
      }}
    >
      {rows.map((row, rowIndex) => (
        <Box
          // Rows are a fixed-length board, so the index is the identity.
          key={rowIndex}
          role="row"
          aria-label={describeRow(row)}
          // Lets a test or an end-to-end run wait for the reveal on a signal
          // rather than on a guessed sleep.
          {...(rowIndex === revealingRow ? { 'data-revealing': 'true' } : {})}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WORD_LENGTH}, 1fr)`,
            gap: 0.75,
            // Gives rotateX somewhere to rotate towards, so the tile reads as
            // turning over rather than being squashed flat.
            perspective: '600px',
            ...(rowIndex === activeRow && rejectionNonce > 0
              ? {
                  animation: `${shake} 380ms`,
                  // Honour a reduced-motion preference (spec §9); the notice
                  // text carries the same information either way.
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }
              : {}),
          }}
        >
          {row.letters.map((letter, columnIndex) => {
            const tile = row.tiles?.[columnIndex];
            const style = tile === undefined ? null : tileStyles[tile];
            const turnsOver = rowIndex === revealingRow && tile !== undefined;
            return (
              <Box
                key={columnIndex}
                role="gridcell"
                data-testid={`tile-${rowIndex}-${columnIndex}`}
                data-state={tile === undefined ? (letter === '' ? 'empty' : 'filled') : String(tile)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(1.4rem, 8vw, 2rem)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  userSelect: 'none',
                  borderRadius: 0.5,
                  border: '2px solid',
                  borderColor:
                    style?.border ?? (letter === '' ? tiles.emptyBorder : tiles.filledBorder),
                  backgroundColor: style?.bg ?? 'transparent',
                  color: style?.color ?? 'text.primary',
                  // `both` holds the unjudged face through the delay, so a tile
                  // waiting its turn does not show its answer early. The landed
                  // keyframe matches the tile's own style, so what it holds
                  // afterwards is what it would have rendered anyway.
                  ...(turnsOver
                    ? {
                        animation: `${turning[tile]} ${timing.flip}ms ease-in-out both`,
                        animationDelay: `${columnIndex * timing.stagger}ms`,
                      }
                    : {}),
                }}
              >
                {letter}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
