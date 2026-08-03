/**
 * Spec §8: what must survive a reload, and what must not break when storage
 * refuses to cooperate.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  MAX_RETAINED_DAYS,
  Repository,
  type DayRecord,
} from '../../src/app/storage/repository';
import { type Storage, createMemoryStorage } from '../../src/app/storage/storage';

function dayRecord(puzzleNumber: number, overrides: Partial<DayRecord> = {}): DayRecord {
  return {
    puzzleNumber,
    settings: { hardMode: false, useHouseStarter: true, confirmed: true },
    guesses: ['crane'],
    status: 'playing',
    ...overrides,
  };
}

/** Storage that throws on everything, like Safari private mode on write. */
function createHostileStorage(): Storage {
  return {
    read: () => {
      throw new Error('nope');
    },
    write: () => {
      throw new Error('quota');
    },
    remove: () => {
      throw new Error('nope');
    },
    keys: () => {
      throw new Error('nope');
    },
  };
}

describe('preferences', () => {
  it('start at the documented default', () => {
    expect(new Repository(createMemoryStorage()).loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('survive a round trip', () => {
    const store = new Repository(createMemoryStorage());
    store.savePreferences({ hardMode: true, useHouseStarter: false });
    expect(store.loadPreferences()).toEqual({ hardMode: true, useHouseStarter: false });
  });

  it('fall back to defaults rather than trusting corrupt data', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:preferences', '{"hardMode":"yes"}');
    expect(new Repository(storage).loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('fall back to defaults on unparseable data', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:preferences', 'not json at all');
    expect(new Repository(storage).loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('the day record', () => {
  it('survives a round trip exactly', () => {
    const store = new Repository(createMemoryStorage());
    const record = dayRecord(12, { guesses: ['crane', 'slate'], status: 'playing' });
    store.saveDay(record);
    expect(store.loadDay(12)).toEqual(record);
  });

  it('is absent for a day never played', () => {
    expect(new Repository(createMemoryStorage()).loadDay(99)).toBeNull();
  });

  it('is rejected when filed under the wrong day', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:day:5', JSON.stringify(dayRecord(6)));
    expect(new Repository(storage).loadDay(5)).toBeNull();
  });

  it('is rejected when the settings were never confirmed', () => {
    const storage = createMemoryStorage();
    storage.write(
      'par:v1:day:5',
      JSON.stringify({ ...dayRecord(5), settings: { hardMode: false, useHouseStarter: true } }),
    );
    expect(new Repository(storage).loadDay(5)).toBeNull();
  });

  it('is rejected when guesses are not strings', () => {
    const storage = createMemoryStorage();
    storage.write('par:v1:day:5', JSON.stringify({ ...dayRecord(5), guesses: [1, 2] }));
    expect(new Repository(storage).loadDay(5)).toBeNull();
  });
});

describe('history', () => {
  it('comes back oldest first', () => {
    const store = new Repository(createMemoryStorage());
    for (const day of [30, 7, 19]) store.saveDay(dayRecord(day));
    expect(store.loadHistory().map((record) => record.puzzleNumber)).toEqual([7, 19, 30]);
  });

  it('skips corrupt records rather than failing the whole read', () => {
    const storage = createMemoryStorage();
    const store = new Repository(storage);
    store.saveDay(dayRecord(1));
    storage.write('par:v1:day:2', '{{{');
    store.saveDay(dayRecord(3));
    expect(store.loadHistory().map((record) => record.puzzleNumber)).toEqual([1, 3]);
  });

  it('bounds growth by dropping the oldest days', () => {
    const store = new Repository(createMemoryStorage());
    for (let day = 1; day <= MAX_RETAINED_DAYS + 10; day += 1) store.saveDay(dayRecord(day));

    const history = store.loadHistory();
    expect(history).toHaveLength(MAX_RETAINED_DAYS);
    expect(history[0]?.puzzleNumber).toBe(11);
    expect(history.at(-1)?.puzzleNumber).toBe(MAX_RETAINED_DAYS + 10);
  });
});

describe('when storage is unavailable', () => {
  it('degrades to in-memory play rather than breaking', () => {
    // Spec §8: private browsing or an exhausted quota must not break the game.
    const store = new Repository(createHostileStorage());

    expect(() => store.saveDay(dayRecord(1))).not.toThrow();
    expect(store.loadDay(1)).toBeNull();
    expect(store.loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(store.loadHistory()).toEqual([]);
    expect(() => store.savePreferences({ hardMode: true, useHouseStarter: true })).not.toThrow();
  });
});
