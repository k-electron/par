import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

import { Tile } from '../../engine/words/pattern';
import { WORD_LENGTH } from '../state/gameSession';

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
`;

/**
 * Tile colours.
 *
 * Increment 11 owns the colorblind-safe palette, so these live in one place
 * rather than being sprinkled through the markup.
 */
const TILE_STYLES: Record<Tile, { bg: string; border: string; color: string }> = {
  [Tile.Absent]: { bg: '#3a3a3c', border: '#3a3a3c', color: '#ffffff' },
  [Tile.Present]: { bg: '#b59f3b', border: '#b59f3b', color: '#ffffff' },
  [Tile.Correct]: { bg: '#538d4e', border: '#538d4e', color: '#ffffff' },
};

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
}

function describeRow(row: BoardRow): string | undefined {
  if (row.tiles === null) return undefined;
  return row.letters
    .map((letter, index) => `${letter.toUpperCase()} ${TILE_LABELS[row.tiles![index]!]}`)
    .join(', ');
}

export function Board({ rows, activeRow, rejectionNonce }: BoardProps) {
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
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WORD_LENGTH}, 1fr)`,
            gap: 0.75,
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
            const style = tile === undefined ? null : TILE_STYLES[tile];
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
                  borderColor: style?.border ?? (letter === '' ? '#3a3a3c' : '#565758'),
                  backgroundColor: style?.bg ?? 'transparent',
                  color: style?.color ?? 'text.primary',
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
