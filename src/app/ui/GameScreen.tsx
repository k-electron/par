import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { RESULTS } from '../copy/results';
import type { ScoringClient } from '../scoring/client';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';
import {
  type GameAction,
  type GameRules,
  type GameSession,
  MAX_GUESSES,
  boardRows,
  keyboardState,
  reduceGame,
  replaySession,
} from '../state/gameSession';
import { Board } from './Board';
import { Keyboard } from './Keyboard';
import { LockedSettings } from './LockedSettings';
import { Results } from './Results';
import { ScoringExplainer } from './ScoringExplainer';
import { ShareButton } from './ShareButton';

export interface GameScreenProps {
  readonly answer: string;
  readonly puzzleNumber: number;
  readonly settings: ConfirmedSettings;
  /** Guesses already played, from storage or the auto-played house starter. */
  readonly restoredGuesses: readonly string[];
  readonly rules: GameRules;
  readonly onProgress?: (guesses: readonly string[], status: GameSession['status']) => void;
  /** Absent means no scoring — the board still plays. */
  readonly scoring?: ScoringClient | undefined;
}

export function GameScreen({
  answer,
  puzzleNumber,
  settings,
  restoredGuesses,
  rules,
  onProgress,
  scoring,
}: GameScreenProps) {
  const [session, dispatch] = useReducer(
    (state: GameSession, action: GameAction) => reduceGame(state, action, rules),
    undefined,
    () => replaySession(answer, rules.ruleset, restoredGuesses),
  );

  const rows = useMemo(() => boardRows(session), [session]);
  const letterStates = useMemo(() => keyboardState(session), [session]);
  const finished = session.status !== 'playing';

  const onLetter = useCallback((letter: string) => dispatch({ type: 'letter', letter }), []);
  const onBackspace = useCallback(() => dispatch({ type: 'backspace' }), []);
  const onSubmit = useCallback(() => dispatch({ type: 'submit' }), []);

  // Persist whenever a guess actually lands, not on every keystroke.
  const lastSaved = useRef(restoredGuesses.length);
  useEffect(() => {
    if (session.guesses.length !== lastSaved.current) {
      lastSaved.current = session.guesses.length;
      onProgress?.(session.guesses, session.status);
    }
  }, [session.guesses, session.status, onProgress]);

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

  const activeRow = finished ? -1 : session.guesses.length;

  const [score, setScore] = useState<GameScore | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    if (!finished || scoring === undefined) return;

    let current = true;
    void scoring
      .score({
        guesses: session.guesses,
        answer,
        tookHouseStarter: settings.useHouseStarter,
        hardMode: settings.hardMode,
      })
      .then((result) => {
        if (current) setScore(result);
      })
      .catch(() => {
        // A scoring failure must not take the board down with it. The player
        // still gets their game; the score simply does not appear.
        if (current) setScore(null);
      });

    return () => {
      current = false;
    };
  }, [finished, scoring, session.guesses, answer, settings.useHouseStarter, settings.hardMode]);

  return (
    <Stack
      spacing={1.5}
      sx={{ height: '100dvh', px: 1, py: 1.5, maxWidth: 520, mx: 'auto', width: '100%' }}
    >
      <Stack spacing={0.75} sx={{ textAlign: 'center' }}>
        <Stack spacing={0.25}>
          <Typography
            component="h1"
            variant="h5"
            sx={{ fontWeight: 700, letterSpacing: '0.08em' }}
          >
            PAR
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Puzzle {puzzleNumber}
          </Typography>
        </Stack>
        <LockedSettings settings={settings} />
      </Stack>

      <Box sx={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', minHeight: 0 }}>
        <Board rows={rows} activeRow={activeRow} rejectionNonce={session.notice?.nonce ?? 0} />
      </Box>

      {/* Reserved height so the board does not jump when a notice appears. */}
      <Box sx={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box aria-live="polite" role="status" sx={{ width: '100%' }}>
          {session.notice !== null && (
            <Alert severity="warning" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              {session.notice.message}
            </Alert>
          )}
          {session.status === 'won' && scoring === undefined && (
            <Alert severity="success" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              Solved in {session.guesses.length} of {MAX_GUESSES}.
            </Alert>
          )}
          {session.status === 'lost' && (
            <Alert severity="info" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              Out of guesses. The answer was {session.answer.toUpperCase()}.
            </Alert>
          )}
        </Box>
      </Box>

      {finished && scoring !== undefined ? (
        <Stack spacing={1} sx={{ pb: 1 }}>
          <Results score={score} settings={settings} />
          {score !== null && (
            <ShareButton
              puzzleNumber={puzzleNumber}
              score={score}
              settings={settings}
              guesses={session.guesses}
            />
          )}
          <Button size="small" variant="text" onClick={() => setExplaining(true)}>
            {RESULTS.explainerLink}
          </Button>
          <ScoringExplainer open={explaining} onClose={() => setExplaining(false)} />
        </Stack>
      ) : (
        <Keyboard
          letterStates={letterStates}
          disabled={finished}
          onLetter={onLetter}
          onBackspace={onBackspace}
          onSubmit={onSubmit}
        />
      )}
    </Stack>
  );
}
