/**
 * The Storage port and its adapters.
 *
 * Spec §8 requires that storage being unavailable or full — private browsing,
 * quota exhaustion, a browser that refuses `localStorage` entirely — degrades
 * to in-memory play rather than breaking the game. That is a lot easier to
 * guarantee when "where things are kept" is a constructor argument than when
 * every call site remembers to wrap itself in a try/catch.
 *
 * Every method here is total: an adapter that throws is treated as an adapter
 * that has nothing, because a player mid-game does not care why the write
 * failed.
 */

export interface Storage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  /** Keys currently held, in a stable order. Used for pruning history. */
  keys(): readonly string[];
}

/** Storage that forgets everything when the tab closes. Always available. */
export function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    read: (key) => entries.get(key) ?? null,
    write: (key, value) => {
      entries.set(key, value);
    },
    remove: (key) => {
      entries.delete(key);
    },
    keys: () => [...entries.keys()].sort(),
  };
}

/**
 * `localStorage`, if it works.
 *
 * Presence is not enough to go on: Safari in private mode exposes the object
 * and throws on write, so this probes with a real round trip before trusting
 * it. Returns null when unusable, and the caller falls back to memory.
 */
export function createLocalStorage(): Storage | null {
  let backing: globalThis.Storage;
  try {
    backing = window.localStorage;
    const probe = '__par_probe__';
    backing.setItem(probe, '1');
    backing.removeItem(probe);
  } catch {
    return null;
  }

  return {
    read: (key) => {
      try {
        return backing.getItem(key);
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      try {
        backing.setItem(key, value);
      } catch {
        // Out of quota, or the user revoked access mid-session. Losing a save
        // is survivable; throwing into a keystroke handler is not.
      }
    },
    remove: (key) => {
      try {
        backing.removeItem(key);
      } catch {
        /* nothing useful to do */
      }
    },
    keys: () => {
      try {
        const found: string[] = [];
        for (let index = 0; index < backing.length; index += 1) {
          const key = backing.key(index);
          if (key !== null) found.push(key);
        }
        return found.sort();
      } catch {
        return [];
      }
    },
  };
}

/** `localStorage` when it is usable, otherwise an in-memory stand-in. */
export function createBestAvailableStorage(): Storage {
  return createLocalStorage() ?? createMemoryStorage();
}
