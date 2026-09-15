import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { useTheme } from '@mui/material/styles';
import { Delete } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tile } from '../../engine/words/pattern';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

const KEY_HINTS: Record<Tile, string> = {
  [Tile.Absent]: 'not in the word',
  [Tile.Present]: 'in the word',
  [Tile.Correct]: 'correct',
};

export interface KeyboardProps {
  readonly letterStates: ReadonlyMap<string, Tile>;
  readonly disabled: boolean;
  readonly onLetter: (letter: string) => void;
  readonly onBackspace: () => void;
  readonly onSubmit: () => void;
}

interface KeyProps {
  readonly label: string;
  readonly ariaLabel: string;
  readonly wide?: boolean;
  readonly state?: Tile | undefined;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children?: ReactNode;
}

function Key({ label, ariaLabel, wide, state, disabled, onPress, children }: KeyProps) {
  const theme = useTheme();
  const { tiles } = theme;
  const isDark = theme.palette.mode === 'dark';
  const isAccessible = tiles.correct === '#00D2FF';

  let bg = isDark
    ? 'linear-gradient(180deg, #232C3F 0%, #161D2B 100%)'
    : 'linear-gradient(180deg, #EAEDF0 0%, #CBD0D6 100%)';
  let border = isDark
    ? '1px solid rgba(0, 240, 255, 0.16)'
    : '1px solid rgba(0, 0, 0, 0.12)';
  let color = isDark ? theme.palette.text.primary : '#0F172A';
  let boxShadow = isDark
    ? 'inset 0 1px 0 rgba(0, 240, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.35)'
    : 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(0, 0, 0, 0.1)';
  let opacity = 1;
  let textShadow = 'none';

  if (state === Tile.Correct) {
    const bloomColor = isAccessible ? 'rgba(0, 210, 255, 0.45)' : 'rgba(0, 255, 163, 0.45)';
    const edgeGlow = isAccessible ? 'rgba(0, 210, 255, 0.9)' : 'rgba(0, 255, 163, 0.9)';
    bg = isDark
      ? `linear-gradient(180deg, ${tiles.correct} 0%, ${isAccessible ? '#00A3C7' : '#00D687'} 100%)`
      : tiles.correct;
    border = `1px solid ${tiles.correct}`;
    color = tiles.textOnCorrect ?? tiles.text;
    textShadow = 'none';
    boxShadow = isDark
      ? `inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -2px 0 ${edgeGlow}, 0 0 14px ${bloomColor}, 0 2px 5px rgba(0, 0, 0, 0.4)`
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15)';
  } else if (state === Tile.Present) {
    const bloomColor = isAccessible ? 'rgba(255, 107, 0, 0.45)' : 'rgba(255, 184, 0, 0.45)';
    const edgeGlow = isAccessible ? 'rgba(255, 107, 0, 0.9)' : 'rgba(255, 184, 0, 0.9)';
    bg = isDark
      ? `linear-gradient(180deg, ${tiles.present} 0%, ${isAccessible ? '#D95700' : '#D99B00'} 100%)`
      : tiles.present;
    border = `1px solid ${tiles.present}`;
    color = tiles.textOnPresent ?? tiles.text;
    textShadow = 'none';
    boxShadow = isDark
      ? `inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -2px 0 ${edgeGlow}, 0 0 14px ${bloomColor}, 0 2px 5px rgba(0, 0, 0, 0.4)`
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15)';
  } else if (state === Tile.Absent) {
    bg = isDark ? '#141923' : tiles.absent;
    border = isDark ? '1px solid rgba(0, 240, 255, 0.06)' : `1px solid ${tiles.absent}`;
    color = isDark ? 'rgba(241, 245, 249, 0.45)' : 'rgba(255, 255, 255, 0.85)';
    boxShadow = isDark
      ? 'inset 0 2px 6px rgba(0, 0, 0, 0.65), inset 0 0 1px rgba(0, 240, 255, 0.05)'
      : 'inset 0 2px 4px rgba(0, 0, 0, 0.2)';
    opacity = isDark ? 0.65 : 0.75;
  }

  return (
    <ButtonBase
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onPress}
      // Without this a tap leaves focus on the key, and the next physical
      // Enter would replay the key instead of submitting.
      onMouseUp={(event) => event.currentTarget.blur()}
      sx={{
        flex: wide === true ? '1.5 1 0' : '1 1 0',
        minWidth: 0,
        height: { xs: 52, sm: 58 },
        borderRadius: 1,
        fontFamily: theme.typography.fontFamily,
        fontWeight: state === Tile.Correct || state === Tile.Present ? 800 : 700,
        fontSize: wide === true ? { xs: '0.72rem', sm: '0.8rem' } : { xs: '1rem', sm: '1.1rem' },
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        backgroundColor: state === undefined ? tiles.keyIdle : undefined,
        background: bg,
        border,
        color,
        textShadow,
        boxShadow,
        opacity,
        backdropFilter: isDark ? 'blur(8px)' : undefined,
        WebkitBackdropFilter: isDark ? 'blur(8px)' : undefined,
        transition:
          'transform 60ms ease, filter 60ms ease, background 140ms ease, background-color 140ms ease, box-shadow 140ms ease, border-color 140ms ease, opacity 140ms ease',
        '&:hover:not(.Mui-disabled)': {
          borderColor: isDark ? 'rgba(0, 240, 255, 0.35)' : undefined,
          filter: isDark ? 'brightness(1.08)' : 'brightness(0.98)',
        },
        '&:active:not(.Mui-disabled)': {
          transform: 'scale(0.96)',
          filter: isDark ? 'brightness(1.3)' : 'brightness(0.92)',
          boxShadow: isDark
            ? '0 0 14px rgba(0, 240, 255, 0.5), inset 0 0 8px rgba(0, 240, 255, 0.3)'
            : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
        },
        '&:focus-visible': {
          outline: `2px solid ${isDark ? '#00FFA3' : theme.palette.primary.main}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transform: 'none !important',
          transition: 'none !important',
        },
        '&.Mui-disabled': {
          opacity: 0.45,
          color: tiles.text,
          cursor: 'not-allowed',
        },
      }}
    >
      {children ?? label}
    </ButtonBase>
  );
}

export function Keyboard({
  letterStates,
  disabled,
  onLetter,
  onBackspace,
  onSubmit,
}: KeyboardProps) {
  return (
    <Box
      data-testid="keyboard"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        width: '100%',
        maxWidth: 500,
        mx: 'auto',
      }}
    >
      {ROWS.map((row, rowIndex) => (
        <Box key={row} sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {rowIndex === 2 && (
            <Key
              label="Enter"
              ariaLabel="Submit guess"
              wide
              disabled={disabled}
              onPress={onSubmit}
            />
          )}
          {[...row].map((letter) => {
            const state = letterStates.get(letter);
            return (
              <Key
                key={letter}
                label={letter}
                ariaLabel={
                  state === undefined ? letter : `${letter}, ${KEY_HINTS[state]}`
                }
                state={state}
                disabled={disabled}
                onPress={() => onLetter(letter)}
              />
            );
          })}
          {rowIndex === 2 && (
            <Key
              label="Backspace"
              ariaLabel="Delete letter"
              wide
              disabled={disabled}
              onPress={onBackspace}
            >
              <Box
                aria-hidden
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Delete size={20} strokeWidth={2.2} aria-hidden />
              </Box>
            </Key>
          )}
        </Box>
      ))}
    </Box>
  );
}
