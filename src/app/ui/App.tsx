import Box from '@mui/material/Box';
import { useCallback, useMemo, useState } from 'react';

import { answers, guesses as dictionary, starters } from '../../data';
import { rulesetFor } from '../../engine/rules/ruleset';
import { puzzleNumberAt } from '../../engine/daily/calendar';
import { drawPuzzle } from '../../engine/daily/puzzle';
import { Repository, type ConfirmedSettings, type DayRecord } from '../storage/repository';
import { createBestAvailableStorage } from '../storage/storage';
import { GameScreen } from './GameScreen';
import { SettingsGate } from './SettingsGate';

export interface AppProps {
  /** Overridable so tests can pin a day and a storage backend. */
  readonly repository?: Repository;
  readonly now?: Date;
}

export function App({ repository, now }: AppProps = {}) {
  const store = useMemo(
    () => repository ?? new Repository(createBestAvailableStorage()),
    [repository],
  );

  const puzzle = useMemo(
    () => drawPuzzle(puzzleNumberAt(now ?? new Date()), { answers, starters }),
    [now],
  );

  // Restoring the day's record is what makes the lock survive a reload: the
  // confirmed settings live in the record, not in component state.
  const [record, setRecord] = useState<DayRecord | null>(() => store.loadDay(puzzle.puzzleNumber));

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

  return (
    <Box component="main">
      {record === null ? (
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
        />
      )}
    </Box>
  );
}
