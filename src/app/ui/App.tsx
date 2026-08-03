import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { answers, guesses as dictionary, starters } from '../../data';
import { rulesetFor } from '../../engine/rules/ruleset';
import { puzzleNumberAt } from '../../engine/daily/calendar';
import { drawPuzzle } from '../../engine/daily/puzzle';
import { createWorkerScoringClient, type ScoringClient } from '../scoring/client';
import { completedDays, summarise } from '../state/stats';
import { createAppTheme, type AppearancePreferences } from '../theme/theme';
import {
  Repository,
  type ConfirmedSettings,
  type DayRecord,
  type StoredScore,
} from '../storage/repository';
import { createBestAvailableStorage } from '../storage/storage';
import { GameScreen } from './GameScreen';
import { Replay } from './Replay';
import { SettingsGate } from './SettingsGate';

/** The replay payload in the current URL fragment, if there is one. */
function replayPayloadFrom(hash: string): string | null {
  const match = /^#r=(.+)$/.exec(hash);
  return match?.[1] ?? null;
}

export interface AppProps {
  /** Overridable so tests can pin a day, a storage backend and a scorer. */
  readonly repository?: Repository;
  readonly now?: Date;
  readonly scoring?: ScoringClient;
  /** Overridable so tests need not manipulate the real location. */
  readonly initialHash?: string;
}

export function App({ repository, now, scoring, initialHash }: AppProps = {}) {
  const store = useMemo(
    () => repository ?? new Repository(createBestAvailableStorage()),
    [repository],
  );

  // One worker for the session, torn down with the app. Built lazily so a test
  // that supplies its own scorer never spawns one.
  const [ownScoring] = useState<ScoringClient | null>(() =>
    scoring === undefined && typeof Worker !== 'undefined' ? createWorkerScoringClient() : null,
  );
  useEffect(() => () => ownScoring?.dispose(), [ownScoring]);
  const scorer = scoring ?? ownScoring ?? undefined;

  const puzzle = useMemo(
    () => drawPuzzle(puzzleNumberAt(now ?? new Date()), { answers, starters }),
    [now],
  );

  // Restoring the day's record is what makes the lock survive a reload: the
  // confirmed settings live in the record, not in component state.
  const [record, setRecord] = useState<DayRecord | null>(() => store.loadDay(puzzle.puzzleNumber));

  /**
   * Bumped whenever a scored day is written, which is the only way the stored
   * history that stats read can change. Stats come out of mutable storage, so
   * they need an explicit signal: nothing about the value of `record` says
   * whether the rest of the history moved.
   */
  const [historyRevision, setHistoryRevision] = useState(0);

  const rules = useMemo(() => {
    const allowed = new Set(dictionary);
    return (settings: ConfirmedSettings) => ({
      isAllowedWord: (word: string) => allowed.has(word),
      ruleset: rulesetFor(settings.hardMode ? 'hard' : 'normal'),
    });
  }, []);

  const confirm = useCallback(
    (preferences: { hardMode: boolean; useHouseStarter: boolean }) => {
      store.savePreferences(preferences);
      const settings: ConfirmedSettings = { ...preferences, confirmed: true };
      // Taking the house starter plays it immediately as guess 1, which is what
      // makes the bet blind: the word appears on the board, never before.
      const opening = preferences.useHouseStarter ? [puzzle.starter] : [];
      const fresh: DayRecord = {
        puzzleNumber: puzzle.puzzleNumber,
        settings,
        guesses: opening,
        status: 'playing',
      };
      store.saveDay(fresh);
      setRecord(fresh);
    },
    [puzzle.puzzleNumber, puzzle.starter, store],
  );

  const persist = useCallback(
    (played: readonly string[], status: DayRecord['status']) => {
      setRecord((current) => {
        if (current === null) return current;
        const next: DayRecord = {
          ...current,
          guesses: played,
          status,
          ...(status === 'playing' ? {} : { completedAt: Date.now() }),
        };
        store.saveDay(next);
        return next;
      });
    },
    [store],
  );

  /** Keep the day's score alongside it, so stats need not re-score a year. */
  const recordScore = useCallback(
    (score: StoredScore) => {
      setRecord((current) => {
        if (current === null) return current;
        const next: DayRecord = { ...current, score };
        store.saveDay(next);
        return next;
      });
      // Stored history has moved, so the stats below need recomputing.
      setHistoryRevision((revision) => revision + 1);
    },
    [store],
  );

  const stats = useMemo(() => {
    void historyRevision;
    const scored = completedDays(store.loadHistory())
      .map((day) =>
        day.score === undefined ? null : { puzzleNumber: day.puzzleNumber, ...day.score },
      )
      .filter((day): day is NonNullable<typeof day> => day !== null);
    return summarise(scored);
  }, [store, historyRevision]);

  const [replayPayload, setReplayPayload] = useState<string | null>(() =>
    replayPayloadFrom(initialHash ?? (typeof location === 'undefined' ? '' : location.hash)),
  );

  const [appearance, setAppearance] = useState<AppearancePreferences>(() =>
    store.loadAppearance(),
  );
  const activeTheme = useMemo(() => createAppTheme(appearance), [appearance]);

  const changeAppearance = useCallback(
    (next: AppearancePreferences) => {
      setAppearance(next);
      store.saveAppearance(next);
    },
    [store],
  );

  const leaveReplay = useCallback(() => {
    setReplayPayload(null);
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, []);

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box component="main">
        {replayPayload !== null ? (
          <Replay payload={replayPayload} store={store} scoring={scorer} onDismiss={leaveReplay} />
        ) : record === null ? (
          <SettingsGate
            puzzleNumber={puzzle.puzzleNumber}
            initial={store.loadPreferences()}
            onConfirm={confirm}
          />
        ) : (
          <GameScreen
            key={puzzle.puzzleNumber}
            answer={puzzle.answer}
            puzzleNumber={puzzle.puzzleNumber}
            settings={record.settings}
            restoredGuesses={record.guesses}
            rules={rules(record.settings)}
            onProgress={persist}
            onScored={recordScore}
            scoring={scorer}
            stats={stats}
            appearance={appearance}
            onAppearanceChange={changeAppearance}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
