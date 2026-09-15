import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';

import { Tile } from '../../engine/words/pattern';
import { WORD_LENGTH } from '../state/gameSession';
import { REVEAL, type RevealTiming } from './reveal';

const shake = keyframes`
  0%, 100% {
    transform: translate3d(0, 0, 0) skewX(0deg) scale(1);
    filter: drop-shadow(0 0 0 rgba(0, 240, 255, 0));
  }
  15% {
    transform: translate3d(-6px, 1px, 0) skewX(-1.5deg) scale(0.99);
    filter: drop-shadow(-2px 0 2px rgba(255, 0, 85, 0.6)) drop-shadow(2px 0 2px rgba(0, 240, 255, 0.6));
  }
  30% {
    transform: translate3d(6px, -1px, 0) skewX(1.8deg) scale(1.01);
    filter: drop-shadow(2px 0 3px rgba(255, 0, 85, 0.7)) drop-shadow(-2px 0 3px rgba(0, 240, 255, 0.7));
  }
  45% {
    transform: translate3d(-5px, 0, 0) skewX(-1deg) scale(0.995);
    filter: drop-shadow(-1.5px 0 2px rgba(255, 0, 85, 0.5)) drop-shadow(1.5px 0 2px rgba(0, 240, 255, 0.5));
  }
  60% {
    transform: translate3d(4px, 1px, 0) skewX(0.8deg) scale(1.005);
    filter: drop-shadow(1.5px 0 2px rgba(255, 0, 85, 0.5)) drop-shadow(-1.5px 0 2px rgba(0, 240, 255, 0.5));
  }
  75% {
    transform: translate3d(-2px, 0, 0) skewX(-0.5deg) scale(1);
    filter: drop-shadow(-0.5px 0 1px rgba(255, 0, 85, 0.3)) drop-shadow(0.5px 0 1px rgba(0, 240, 255, 0.3));
  }
  90% {
    transform: translate3d(1px, 0, 0) skewX(0.2deg) scale(1);
    filter: drop-shadow(0 0 0 rgba(0, 240, 255, 0));
  }
`;

const reticlePulse = keyframes`
  0%, 100% {
    border-color: rgba(0, 240, 255, 0.65);
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.35), inset 0 0 8px rgba(0, 240, 255, 0.2);
  }
  50% {
    border-color: rgba(0, 240, 255, 0.95);
    box-shadow: 0 0 18px rgba(0, 240, 255, 0.65), inset 0 0 12px rgba(0, 240, 255, 0.35);
  }
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
  readonly boxShadow: string;
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
    box-shadow: ${look.boxShadow};
  `;

  return keyframes`
    0%    { transform: rotateX(0deg);   filter: brightness(1);    ${face(idle)} }
    49.9% { transform: rotateX(-90deg); filter: brightness(1.35); ${face(idle)} }
    50%   { transform: rotateX(-90deg); filter: brightness(1.35); ${face(landed)} }
    100%  { transform: rotateX(0deg);   filter: brightness(1);    ${face(landed)} }
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
  const isDark = theme.palette.mode === 'dark';
  const isAccessible = tiles.correct === '#00D2FF';

  const tileStyles: Record<Tile, TileLook> = {
    [Tile.Absent]: {
      bg: tiles.absent,
      border: isDark ? 'rgba(0, 240, 255, 0.15)' : tiles.absent,
      color: tiles.text,
      boxShadow: isDark ? 'inset 0 0 8px rgba(0, 0, 0, 0.5)' : 'none',
    },
    [Tile.Present]: {
      bg: tiles.present,
      border: tiles.present,
      color: tiles.textOnPresent ?? tiles.text,
      boxShadow: isDark
        ? isAccessible
          ? 'inset 0 0 12px rgba(255, 107, 0, 0.35), 0 0 16px rgba(255, 107, 0, 0.3)'
          : 'inset 0 0 12px rgba(255, 184, 0, 0.35), 0 0 16px rgba(255, 184, 0, 0.3)'
        : 'none',
    },
    [Tile.Correct]: {
      bg: tiles.correct,
      border: tiles.correct,
      color: tiles.textOnCorrect ?? tiles.text,
      boxShadow: isDark
        ? isAccessible
          ? 'inset 0 0 12px rgba(0, 210, 255, 0.35), 0 0 16px rgba(0, 210, 255, 0.3)'
          : 'inset 0 0 12px rgba(0, 255, 163, 0.35), 0 0 16px rgba(0, 255, 163, 0.3)'
        : 'none',
    },
  };

  // How a filled but unjudged tile looks: the state every revealing tile starts
  // from, so the row appears to be waiting its turn rather than already known.
  const unjudged: TileLook = {
    bg: 'transparent',
    border: tiles.filledBorder,
    color: theme.palette.text.primary,
    boxShadow: isDark
      ? '0 0 8px rgba(0, 240, 255, 0.25), inset 0 0 6px rgba(0, 240, 255, 0.15)'
      : 'none',
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
      {rows.map((row, rowIndex) => {
        const isActiveRow = rowIndex === activeRow && row.tiles === null;
        const nextUnfilledIndex = isActiveRow ? row.letters.findIndex((l) => l === '') : -1;

        return (
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
                    animation: `${shake} 380ms ease-in-out`,
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
              const isCursor = isActiveRow && nextUnfilledIndex === columnIndex;
              const isFilledDraft = isActiveRow && letter !== '';

              let cellBorder = letter === '' ? tiles.emptyBorder : tiles.filledBorder;
              const cellBg = style?.bg ?? 'transparent';
              let cellShadow = 'none';

              if (style) {
                cellBorder = style.border;
                cellShadow = style.boxShadow;
              } else if (isCursor) {
                cellBorder = 'rgba(0, 240, 255, 0.65)';
                cellShadow = isDark
                  ? '0 0 10px rgba(0, 240, 255, 0.35), inset 0 0 8px rgba(0, 240, 255, 0.2)'
                  : 'none';
              } else if (isFilledDraft) {
                cellBorder = tiles.filledBorder;
                cellShadow = isDark
                  ? '0 0 8px rgba(0, 240, 255, 0.25), inset 0 0 6px rgba(0, 240, 255, 0.15)'
                  : 'none';
              }

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
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    userSelect: 'none',
                    borderRadius: 0.5,
                    border: '2px solid',
                    borderColor: cellBorder,
                    backgroundColor: cellBg,
                    color: style?.color ?? 'text.primary',
                    boxShadow: cellShadow,
                    backdropFilter: isDark ? 'blur(6px)' : undefined,
                    WebkitBackdropFilter: isDark ? 'blur(6px)' : undefined,
                    transition: turnsOver
                      ? undefined
                      : 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                    // `both` holds the unjudged face through the delay, so a tile
                    // waiting its turn does not show its answer early. The landed
                    // keyframe matches the tile's own style, so what it holds
                    // afterwards is what it would have rendered anyway.
                    ...(turnsOver
                      ? {
                          animation: `${turning[tile]} ${timing.flip}ms ease-in-out both`,
                          animationDelay: `${columnIndex * timing.stagger}ms`,
                        }
                      : isCursor && isDark
                        ? {
                            animation: `${reticlePulse} 1.6s ease-in-out infinite`,
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                          }
                        : {}),
                  }}
                >
                  {letter}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
