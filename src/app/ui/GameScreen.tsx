import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import {
  type GameRules,
  MAX_GUESSES,
  boardRows,
  createSession,
  keyboardState,
  reduceGame,
} from '../state/gameSession';
import { Board } from './Board';
import { Keyboard } from './Keyboard';

export interface GameScreenProps {
  readonly answer: string;
  readonly puzzleNumber: number;
  readonly rules: GameRules;
}

export function GameScreen({ answer, puzzleNumber, rules }: GameScreenProps) {
  const [session, dispatch] = useReducer(
    (state: ReturnType<typeof createSession>, action: Parameters<typeof reduceGame>[1]) =>
      reduceGame(state, action, rules),
    answer,
    createSession,
  );

  const rows = useMemo(() => boardRows(session), [session]);
  const letterStates = useMemo(() => keyboardState(session), [session]);
  const finished = session.status !== 'playing';

  const onLetter = useCallback((letter: string) => dispatch({ type: 'letter', letter }), []);
  const onBackspace = useCallback(() => dispatch({ type: 'backspace' }), []);
  const onSubmit = useCallback(() => dispatch({ type: 'submit' }), []);

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      // Leave browser and OS shortcuts alone.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        onBackspace();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        onLetter(event.key);
      }
    }

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onLetter, onBackspace, onSubmit]);

  // The row being typed into is the one after the last submitted guess.
  const activeRow = finished ? -1 : session.guesses.length;

  return (
    <Stack
      spacing={2}
      sx={{ height: '100dvh', px: 1, py: 1.5, maxWidth: 520, mx: 'auto', width: '100%' }}
    >
      <Stack spacing={0.25} sx={{ textAlign: 'center' }}>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          PAR
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Puzzle {puzzleNumber}
        </Typography>
      </Stack>

      <Box sx={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', minHeight: 0 }}>
        <Board
          rows={rows}
          activeRow={activeRow}
          rejectionNonce={session.notice?.nonce ?? 0}
        />
      </Box>

      {/* Reserved height so the board does not jump when a notice appears. */}
      <Box sx={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box aria-live="polite" role="status" sx={{ width: '100%' }}>
          {session.notice !== null && (
            <Alert severity="warning" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              {session.notice.message}
            </Alert>
          )}
          {session.status === 'won' && (
            <Alert severity="success" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              Solved in {session.guesses.length} of {MAX_GUESSES}. Scoring arrives in a later
              increment.
            </Alert>
          )}
          {session.status === 'lost' && (
            <Alert severity="info" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              Out of guesses. The answer was {session.answer.toUpperCase()}.
            </Alert>
          )}
        </Box>
      </Box>

      <Keyboard
        letterStates={letterStates}
        disabled={finished}
        onLetter={onLetter}
        onBackspace={onBackspace}
        onSubmit={onSubmit}
      />
    </Stack>
  );
}
