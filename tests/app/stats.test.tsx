/**
 * Spec §8: retained days, the personal stats they power, bounded growth, and a
 * schema that upgrades rather than losing somebody's history.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { EMPTY_STATS, completedDays, summarise, type ScoredDay } from '../../src/app/state/stats';
import {
  MAX_RETAINED_DAYS,
  Repository,
  SCHEMA_VERSION,
  type DayRecord,
} from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { StatsPanel } from '../../src/app/ui/Stats';
import { App } from '../../src/app/ui/App';
import { createDirectScoringClient } from '../../src/app/scoring/direct';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

function day(puzzleNumber: number, overrides: Partial<ScoredDay> = {}): ScoredDay {
  return { puzzleNumber, solved: true, guessesUsed: 4, total: 100, skill: 90, ...overrides };
}

afterEach(cleanup);

describe('summarising a record', () => {
  it('is empty with nothing played', () => {
    expect(summarise([])).toEqual(EMPTY_STATS);
  });

  it('averages totals and skill across every game, solved or not', () => {
    const stats = summarise([
      day(1, { total: 90, skill: 80 }),
      day(2, { total: 110, skill: 100, solved: false }),
    ]);

    expect(stats.played).toBe(2);
    expect(stats.averageTotal).toBe(100);
    expect(stats.averageSkill).toBe(90);
  });

  it('averages guesses over solved games only', () => {
    // An unsolved game has no guess count worth averaging; counting it as six
    // would quietly flatter a player who never finished.
    const stats = summarise([
      day(1, { guessesUsed: 3 }),
      day(2, { guessesUsed: 5 }),
      day(3, { solved: false, guessesUsed: 6 }),
    ]);

    expect(stats.averageGuesses).toBe(4);
    expect(stats.solved).toBe(2);
    expect(stats.solveRate).toBeCloseTo(66.67, 1);
  });

  it('distributes solves by guess count', () => {
    const stats = summarise([
      day(1, { guessesUsed: 2 }),
      day(2, { guessesUsed: 4 }),
      day(3, { guessesUsed: 4 }),
      day(4, { solved: false, guessesUsed: 6 }),
    ]);

    expect(stats.distribution).toEqual([0, 1, 0, 2, 0, 0]);
  });

  it('reads days in any order', () => {
    const ascending = summarise([day(1), day(2), day(3)]);
    const jumbled = summarise([day(3), day(1), day(2)]);
    expect(jumbled).toEqual(ascending);
  });
});

describe('streaks', () => {
  it('counts consecutive solved days', () => {
    const stats = summarise([day(1), day(2), day(3)]);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it('breaks on a gap in the calendar, not just on a loss', () => {
    // Skipping a day ends a streak. That is what a streak means to whoever is
    // counting it.
    const stats = summarise([day(1), day(2), day(9), day(10)]);
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('breaks on an unsolved day', () => {
    const stats = summarise([day(1), day(2), day(3, { solved: false }), day(4)]);
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(2);
  });

  it('remembers the best run after the current one lapses', () => {
    const stats = summarise([day(1), day(2), day(3), day(4, { solved: false }), day(5)]);
    expect(stats.bestStreak).toBe(3);
    expect(stats.currentStreak).toBe(1);
  });

  it('is zero when the most recent day was unsolved', () => {
    expect(summarise([day(1), day(2, { solved: false })]).currentStreak).toBe(0);
  });
});

describe('history from storage', () => {
  function record(puzzleNumber: number, overrides: Partial<DayRecord> = {}): DayRecord {
    return {
      puzzleNumber,
      settings: { hardMode: false, useHouseStarter: true, confirmed: true },
      guesses: ['crane'],
      status: 'won',
      score: { total: 100, skill: 90, guessesUsed: 1, solved: true },
      ...overrides,
    };
  }

  it('keeps only finished days', () => {
    const store = new Repository(createMemoryStorage());
    store.saveDay(record(1));
    store.saveDay(record(2, { status: 'playing' }));
    store.saveDay(record(3, { status: 'lost' }));

    expect(completedDays(store.loadHistory()).map((r) => r.puzzleNumber)).toEqual([1, 3]);
  });

  it('round-trips a stored score', () => {
    const store = new Repository(createMemoryStorage());
    store.saveDay(record(7, { score: { total: 88.6, skill: 85.8, guessesUsed: 3, solved: true } }));

    expect(store.loadDay(7)?.score).toEqual({
      total: 88.6,
      skill: 85.8,
      guessesUsed: 3,
      solved: true,
    });
  });

  it('discards a corrupt score rather than trusting it', () => {
    const storage = createMemoryStorage();
    storage.write(
      `par:v${SCHEMA_VERSION}:day:4`,
      JSON.stringify({ ...record(4), score: { total: 'lots' } }),
    );

    expect(new Repository(storage).loadDay(4)?.score).toBeUndefined();
  });

  it('bounds growth to a year of play', () => {
    const store = new Repository(createMemoryStorage());
    for (let index = 1; index <= MAX_RETAINED_DAYS + 5; index += 1) store.saveDay(record(index));

    const history = store.loadHistory();
    expect(history).toHaveLength(MAX_RETAINED_DAYS);
    expect(history[0]?.puzzleNumber).toBe(6);
  });
});

describe('upgrading stored data', () => {
  it('carries a version 1 record forward', () => {
    // Written by the build before day records held their score.
    const storage = createMemoryStorage();
    storage.write(
      'par:v1:day:12',
      JSON.stringify({
        puzzleNumber: 12,
        settings: { hardMode: true, useHouseStarter: false, confirmed: true },
        guesses: ['crane', 'slate'],
        status: 'won',
        completedAt: 1_700_000_000_000,
      }),
    );
    storage.write('par:v1:preferences', JSON.stringify({ hardMode: true, useHouseStarter: false }));

    const store = new Repository(storage);

    expect(store.loadDay(12)).toMatchObject({
      puzzleNumber: 12,
      status: 'won',
      guesses: ['crane', 'slate'],
      settings: { hardMode: true, useHouseStarter: false, confirmed: true },
    });
    expect(store.loadPreferences()).toEqual({ hardMode: true, useHouseStarter: false });
  });

  it('leaves the old keys alone so a downgrade loses nothing', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:preferences', JSON.stringify({ hardMode: true, useHouseStarter: false }));

    new Repository(storage);
    expect(storage.read('par:v1:preferences')).not.toBeNull();
  });

  it('never lets older data overwrite newer', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:preferences', JSON.stringify({ hardMode: true, useHouseStarter: true }));
    storage.write(
      `par:v${SCHEMA_VERSION}:preferences`,
      JSON.stringify({ hardMode: false, useHouseStarter: false }),
    );

    expect(new Repository(storage).loadPreferences()).toEqual({
      hardMode: false,
      useHouseStarter: false,
    });
  });

  it('skips a version 1 record that no longer parses', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:day:3', '{ not json');
    expect(() => new Repository(storage)).not.toThrow();
    expect(new Repository(storage).loadDay(3)).toBeNull();
  });
});

describe('the stats panel', () => {
  function renderPanel(days: readonly ScoredDay[]) {
    return render(
      <ThemeProvider theme={theme}>
        <StatsPanel stats={summarise(days)} />
      </ThemeProvider>,
    );
  }

  it('says so plainly when there is nothing yet', () => {
    renderPanel([]);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it('leads with the averages, because that is where skill shows', () => {
    renderPanel([day(1, { total: 96, skill: 88 }), day(2, { total: 104, skill: 92 })]);

    expect(screen.getByText('100.0')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('average total')).toBeInTheDocument();
    expect(screen.getByText('average skill')).toBeInTheDocument();
  });

  it('shows the guess distribution', () => {
    renderPanel([day(1, { guessesUsed: 3 }), day(2, { guessesUsed: 3 })]);
    expect(screen.getByText('Guess distribution')).toBeInTheDocument();
  });
});

describe('stats in the app', () => {
  it('is reachable and reflects a finished game', async () => {
    const user = userEvent.setup();
    const store = new Repository(createMemoryStorage());

    render(
      <ThemeProvider theme={theme}>
        <App repository={store} now={FIXED_NOW} scoring={createDirectScoringClient()} />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);

    // The score is kept with the day, so the stats view never re-scores.
    expect(store.loadDay(165)?.score?.solved).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Your record' }));
    expect(await screen.findByText('average total')).toBeInTheDocument();
    expect(screen.getByText('played')).toBeInTheDocument();
  });
});
