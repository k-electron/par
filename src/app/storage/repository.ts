/**
 * What Par keeps, and how it survives a reload.
 *
 * Everything is namespaced and version-stamped (spec §8). Reads are defensive:
 * a record written by a future version, or corrupted by hand, is discarded
 * rather than trusted, because a half-understood save is worse than a fresh
 * start.
 */

import type { Storage } from './storage';

const NAMESPACE = 'par';
export const SCHEMA_VERSION = 1;

const PREFERENCES_KEY = `${NAMESPACE}:v${SCHEMA_VERSION}:preferences`;
const DAY_KEY_PREFIX = `${NAMESPACE}:v${SCHEMA_VERSION}:day:`;

/** Bounds growth (spec §8). A year of play is plenty to compute stats from. */
export const MAX_RETAINED_DAYS = 365;

/** What the player prefers, remembered across days so the confirm is one click. */
export interface Preferences {
  readonly hardMode: boolean;
  readonly useHouseStarter: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  hardMode: false,
  useHouseStarter: true,
};

/**
 * The settings a player committed to for one day.
 *
 * Frozen once confirmed. Spec §6 and philosophy position 3: the bonus pays for
 * a blind commitment, and a commitment you can withdraw after peeking is not
 * one.
 */
export interface ConfirmedSettings extends Preferences {
  readonly confirmed: true;
}

export interface DayRecord {
  readonly puzzleNumber: number;
  readonly settings: ConfirmedSettings;
  readonly guesses: readonly string[];
  readonly status: 'playing' | 'won' | 'lost';
  /** Set once the day ends, so history and stats can read it back. */
  readonly completedAt?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPreferencesFrom(value: unknown): Preferences | null {
  if (!isPlainObject(value)) return null;
  const { hardMode, useHouseStarter } = value;
  if (typeof hardMode !== 'boolean' || typeof useHouseStarter !== 'boolean') return null;
  return { hardMode, useHouseStarter };
}

function readDayRecordFrom(value: unknown): DayRecord | null {
  if (!isPlainObject(value)) return null;

  const { puzzleNumber, settings, guesses, status, completedAt } = value;
  if (typeof puzzleNumber !== 'number' || !Number.isSafeInteger(puzzleNumber)) return null;
  if (status !== 'playing' && status !== 'won' && status !== 'lost') return null;
  if (!Array.isArray(guesses) || guesses.some((word) => typeof word !== 'string')) return null;

  const preferences = readPreferencesFrom(settings);
  if (preferences === null) return null;
  if (!isPlainObject(settings) || settings['confirmed'] !== true) return null;

  return {
    puzzleNumber,
    settings: { ...preferences, confirmed: true },
    guesses: guesses as readonly string[],
    status,
    ...(typeof completedAt === 'number' ? { completedAt } : {}),
  };
}

/**
 * Wrap a backend so it can never throw into the game.
 *
 * The bundled adapters already swallow their own failures, but the guarantee
 * spec §8 asks for is about the player's experience, not about adapters being
 * well behaved. Enforcing it once here means a future backend cannot quietly
 * reintroduce a crash on a keystroke.
 */
function neverThrows(storage: Storage): Storage {
  return {
    read: (key) => {
      try {
        return storage.read(key);
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      try {
        storage.write(key, value);
      } catch {
        /* a lost save is survivable; a thrown one is not */
      }
    },
    remove: (key) => {
      try {
        storage.remove(key);
      } catch {
        /* nothing useful to do */
      }
    },
    keys: () => {
      try {
        return storage.keys();
      } catch {
        return [];
      }
    },
  };
}

export class Repository {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = neverThrows(storage);
  }

  loadPreferences(): Preferences {
    return readPreferencesFrom(parse(this.storage.read(PREFERENCES_KEY))) ?? DEFAULT_PREFERENCES;
  }

  savePreferences(preferences: Preferences): void {
    this.storage.write(PREFERENCES_KEY, JSON.stringify(preferences));
  }

  loadDay(puzzleNumber: number): DayRecord | null {
    const record = readDayRecordFrom(parse(this.storage.read(DAY_KEY_PREFIX + puzzleNumber)));
    // A record filed under the wrong day is corrupt, not merely stale.
    return record !== null && record.puzzleNumber === puzzleNumber ? record : null;
  }

  saveDay(record: DayRecord): void {
    this.storage.write(DAY_KEY_PREFIX + record.puzzleNumber, JSON.stringify(record));
    this.prune();
  }

  /** Every retained day, oldest first. */
  loadHistory(): readonly DayRecord[] {
    const records: DayRecord[] = [];
    for (const key of this.storage.keys()) {
      if (!key.startsWith(DAY_KEY_PREFIX)) continue;
      const record = readDayRecordFrom(parse(this.storage.read(key)));
      if (record !== null) records.push(record);
    }
    return records.sort((a, b) => a.puzzleNumber - b.puzzleNumber);
  }

  /** Drop the oldest days once there are more than {@link MAX_RETAINED_DAYS}. */
  private prune(): void {
    const dayKeys = this.storage.keys().filter((key) => key.startsWith(DAY_KEY_PREFIX));
    if (dayKeys.length <= MAX_RETAINED_DAYS) return;

    const byAge = dayKeys
      .map((key) => ({ key, day: Number(key.slice(DAY_KEY_PREFIX.length)) }))
      .filter(({ day }) => Number.isFinite(day))
      .sort((a, b) => a.day - b.day);

    for (const { key } of byAge.slice(0, byAge.length - MAX_RETAINED_DAYS)) {
      this.storage.remove(key);
    }
  }
}
