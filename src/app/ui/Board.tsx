import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';

import { Tile } from '../../engine/words/pattern';
import { WORD_LENGTH } from '../state/gameSession';

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
}

function describeRow(row: BoardRow): string | undefined {
  if (row.tiles === null) return undefined;
  return row.letters
    .map((letter, index) => `${letter.toUpperCase()} ${TILE_LABELS[row.tiles![index]!]}`)
    .join(', ');
}

export function Board({ rows, activeRow, rejectionNonce }: BoardProps) {
  const { tiles } = useTheme();
  const tileStyles: Record<Tile, { bg: string; border: string; color: string }> = {
    [Tile.Absent]: { bg: tiles.absent, border: tiles.absent, color: tiles.text },
    [Tile.Present]: { bg: tiles.present, border: tiles.present, color: tiles.text },
    [Tile.Correct]: { bg: tiles.correct, border: tiles.correct, color: tiles.text },
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
            const style = tile === undefined ? null : tileStyles[tile];
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
