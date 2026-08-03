import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { useTheme } from '@mui/material/styles';
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
  const { tiles } = useTheme();
  const style =
    state === undefined
      ? null
      : {
          bg: { [Tile.Absent]: tiles.absent, [Tile.Present]: tiles.present, [Tile.Correct]: tiles.correct }[
            state
          ],
          color: tiles.text,
        };
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
        fontWeight: 700,
        fontSize: wide === true ? '0.75rem' : '1rem',
        textTransform: 'uppercase',
        backgroundColor: style?.bg ?? tiles.keyIdle,
        color: style?.color ?? tiles.text,
        transition: 'background-color 120ms',
        '&.Mui-disabled': { opacity: 0.5, color: tiles.text },
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
              <Box aria-hidden component="span" sx={{ fontSize: '1.15rem' }}>
                &#9003;
              </Box>
            </Key>
          )}
        </Box>
      ))}
    </Box>
  );
}
