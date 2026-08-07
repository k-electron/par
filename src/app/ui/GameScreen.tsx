import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { OUTCOME, RESULTS } from '../copy/results';
import type { ScoringClient } from '../scoring/client';
import type { GameScore } from '../scoring/protocol';
import type { PlayerStats } from '../state/stats';
import type { ConfirmedSettings, StoredScore } from '../storage/repository';
import type { AppearancePreferences } from '../theme/theme';
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
import { AppearanceMenu } from './AppearanceMenu';
import { Board } from './Board';
import { DefinitionLink } from './DefinitionLink';
import { INSTANT_REVEAL, REVEAL, revealDuration, type RevealTiming } from './reveal';
import { Keyboard } from './Keyboard';
import { LockedSettings } from './LockedSettings';
import { Results } from './Results';
import { ScoringExplainer } from './ScoringExplainer';
import { ShareButton } from './ShareButton';
import { StatsButton, StatsDialog } from './Stats';

export interface GameScreenProps {
  readonly answer: string;
  readonly puzzleNumber: number;
  readonly settings: ConfirmedSettings;
  /** Guesses already played, from storage or the auto-played house starter. */
  readonly restoredGuesses: readonly string[];
  readonly rules: GameRules;
  readonly onProgress?: (guesses: readonly string[], status: GameSession['status']) => void;
  /** Called once the finished game has a score, so it can be kept with the day. */
  readonly onScored?: ((score: StoredScore) => void) | undefined;
  /** Absent means no scoring — the board still plays. */
  readonly scoring?: ScoringClient | undefined;
  readonly stats?: PlayerStats | undefined;
  readonly appearance?: AppearancePreferences | undefined;
  readonly onAppearanceChange?: ((preferences: AppearancePreferences) => void) | undefined;
  /** Overridable so tests can play without waiting on the animation. */
  readonly reveal?: RevealTiming;
  /**
   * Whether the guesses already present at mount should turn over.
   *
   * True for the house starter, which is played the instant the day is
   * confirmed and is the one moment worth making a show of — the blind bet
   * turning face up. False for a game restored from storage, where the rows were
   * revealed on an earlier visit and replaying the animation would be a lie
   * about when they happened.
   */
  readonly revealOnMount?: boolean;
}

export function GameScreen({
  answer,
  puzzleNumber,
  settings,
  restoredGuesses,
  rules,
  onProgress,
  onScored,
  scoring,
  stats,
  appearance,
  onAppearanceChange,
  reveal = REVEAL,
  revealOnMount = false,
}: GameScreenProps) {
  const [session, dispatch] = useReducer(
    (state: GameSession, action: GameAction) => reduceGame(state, action, rules),
    undefined,
    () => replaySession(answer, rules.ruleset, restoredGuesses),
  );

  // Somebody who has asked for less motion gets the board's state without the
  // theatre. The theme already neuters the animation itself; this also collapses
  // the wait, so nothing is gated behind a flip they will not see.
  const stillness = useMediaQuery('(prefers-reduced-motion: reduce)');
  const timing = stillness ? INSTANT_REVEAL : reveal;

  /**
   * The row turning over, or -1.
   *
   * Presentation only, and deliberately not in the reducer: the rules of the
   * game do not depend on how long an animation takes, and putting a timer in
   * there would make a pure function answer differently depending on when it was
   * asked.
   */
  const [revealingRow, setRevealingRow] = useState(
    revealOnMount && restoredGuesses.length > 0 ? restoredGuesses.length - 1 : -1,
  );
  const [turnedThrough, setTurnedThrough] = useState(restoredGuesses.length);

  /**
   * Start the reveal during render, not in an effect.
   *
   * Not a style preference. A tile's own style *is* its final colour, and the
   * animation is what conceals it until the flip reaches halfway — so a row must
   * never be painted before its animation is attached. An effect runs after the
   * browser has had the chance to paint, which left the whole row showing its
   * answer for a frame or two before turning over. It reproduced on every run,
   * 15 to 28ms in, and was visible whenever a paint happened to land there.
   *
   * Adjusting state during render is React's documented answer to this: the
   * component re-runs immediately and the first commit already has the animation,
   * so there is no window rather than a narrower one.
   */
  if (session.guesses.length > turnedThrough) {
    setTurnedThrough(session.guesses.length);
    setRevealingRow(session.guesses.length - 1);
  }

  const rows = useMemo(() => boardRows(session), [session]);
  // Keys hold still while the newest row turns, then catch up with it.
  const letterStates = useMemo(
    () => keyboardState(session, revealingRow === -1 ? undefined : revealingRow),
    [session, revealingRow],
  );

  const revealing = revealingRow !== -1;
  // `over` is about the game, `finished` about the screen. The score is computed
  // from the first, shown on the second, so the worker runs during the flip and
  // the number is already waiting when the last tile lands.
  const over = session.status !== 'playing';
  const finished = over && !revealing;

  const onLetter = useCallback((letter: string) => dispatch({ type: 'letter', letter }), []);
  const onBackspace = useCallback(() => dispatch({ type: 'backspace' }), []);
  // Letters and backspace stay live through the reveal so no keystroke is
  // swallowed, but a guess cannot be submitted onto a row still turning over.
  const onSubmit = useCallback(() => {
    if (revealing) return;
    dispatch({ type: 'submit' });
  }, [revealing]);

  // Depends on the duration rather than the timing object, so a caller passing a
  // fresh object literal every render cannot restart the clock forever.
  const settleAfter = revealDuration(timing);
  useEffect(() => {
    if (revealingRow === -1) return;
    const settled = setTimeout(() => setRevealingRow(-1), settleAfter);
    return () => clearTimeout(settled);
  }, [revealingRow, settleAfter]);

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
    if (!over || scoring === undefined) return;

    let current = true;
    void scoring
      .score({
        guesses: session.guesses,
        answer,
        tookHouseStarter: settings.useHouseStarter,
        hardMode: settings.hardMode,
      })
      .then((result) => {
        if (!current) return;
        setScore(result);
        onScored?.({
          total: result.total,
          skill: result.skill,
          guessesUsed: result.guessesUsed,
          solved: result.solved,
        });
      })
      .catch(() => {
        // A scoring failure must not take the board down with it. The player
        // still gets their game; the score simply does not appear.
        if (current) setScore(null);
      });

    return () => {
      current = false;
    };
  }, [over, scoring, session.guesses, answer, settings.useHouseStarter, settings.hardMode, onScored]);

  const [showingStats, setShowingStats] = useState(false);

  return (
    <Stack
      spacing={1.5}
      sx={{
        // While playing, pin to the viewport so the board and keyboard fit
        // without scrolling — that is what makes it comfortable one-handed.
        // Once the results appear the content is legitimately taller than the
        // screen, so the height has to be released or the board and the
        // results overlap instead of stacking.
        minHeight: '100dvh',
        ...(finished ? {} : { height: '100dvh' }),
        px: 1,
        py: 1.5,
        maxWidth: 520,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Stack spacing={0.75} sx={{ textAlign: 'center' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ flex: '1 1 0' }} />
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
          <Box sx={{ flex: '1 1 0', textAlign: 'right' }}>
            {appearance !== undefined && onAppearanceChange !== undefined && (
              <AppearanceMenu preferences={appearance} onChange={onAppearanceChange} />
            )}
            {stats !== undefined && <StatsButton onOpen={() => setShowingStats(true)} />}
          </Box>
        </Stack>
        <LockedSettings settings={settings} />
      </Stack>

      {stats !== undefined && (
        <StatsDialog
          open={showingStats}
          stats={stats}
          onClose={() => setShowingStats(false)}
        />
      )}

      <Box
        sx={{
          // Grows to fill the screen while playing; once finished it takes only
          // the room the board needs so the results can follow it.
          flex: finished ? '0 0 auto' : '1 1 auto',
          display: 'flex',
          alignItems: 'center',
          minHeight: 0,
        }}
      >
        <Board
          rows={rows}
          activeRow={activeRow}
          rejectionNonce={session.notice?.nonce ?? 0}
          revealingRow={revealingRow}
          timing={timing}
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
          {/*
            Both wait for the row to settle. Naming the answer while its row is
            still turning over gives away the ending mid-sentence.
          */}
          {finished && session.status === 'won' && scoring === undefined && (
            <Alert severity="success" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              {OUTCOME.own.solved(session.guesses.length, MAX_GUESSES)}
            </Alert>
          )}
          {finished && session.status === 'lost' && (
            <Alert severity="info" variant="outlined" sx={{ py: 0, justifyContent: 'center' }}>
              {OUTCOME.own.lost(session.answer)}
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
          <DefinitionLink word={answer} />
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
