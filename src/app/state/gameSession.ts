/**
 * The board's state machine.
 *
 * Kept pure and free of React so the rules can be tested by playing games
 * rather than by rendering them. The UI owns presentation; everything about
 * what a guess does lives here.
 *
 * This increment plays with the player's own opener under normal-mode rules.
 * The settings gate, the house starter and hard-mode legality arrive in
 * increment 7, and nothing here is scored yet — increment 8 owns that.
 */

import { MAX_GUESSES } from '../../engine/config/constants';
import type { Constraints } from '../../engine/rules/constraints';
import type { Ruleset } from '../../engine/rules/ruleset';
import { CODE_A, WORD_LENGTH } from '../../engine/words/letters';
import { Tile, WIN_PATTERN, computePattern, tilesFromPattern } from '../../engine/words/pattern';

// Re-exported, not redeclared. The board used to carry its own copies of both,
// which meant the number of rows it drew and the number of buckets the stats
// histogram allocated were free to disagree.
export { MAX_GUESSES, WORD_LENGTH };

export type GameStatus = 'playing' | 'won' | 'lost';

/** Why the board rejected something, for the player and for screen readers. */
export interface Notice {
  readonly message: string;
  /** Bumped on every rejection so a repeat of the same message still animates. */
  readonly nonce: number;
}

export interface GameSession {
  readonly answer: string;
  readonly guesses: readonly string[];
  /** Feedback for each submitted guess, index-aligned with `guesses`. */
  readonly patterns: readonly number[];
  /** What the player is typing, up to `WORD_LENGTH`. */
  readonly draft: string;
  readonly status: GameStatus;
  readonly notice: Notice | null;
  /** Accumulated hard-mode constraints. Empty and inert in normal mode. */
  readonly constraints: Constraints;
}

export type GameAction =
  | { readonly type: 'letter'; readonly letter: string }
  | { readonly type: 'backspace' }
  | { readonly type: 'submit' }
  | { readonly type: 'dismissNotice' };

/** What the board needs to know to judge a guess. */
export interface GameRules {
  /** Whether a word may be submitted at all. Spec §6: rejected without cost. */
  isAllowedWord(word: string): boolean;
  /**
   * The legality rules in force. Hard mode restricts what may be played from
   * guess 2 onward — including when guess 1 was the house starter, since the
   * starter generates constraints like any other guess (spec §6).
   */
  readonly ruleset: Ruleset;
}

export function createSession(answer: string, ruleset: Ruleset): GameSession {
  return {
    answer,
    guesses: [],
    patterns: [],
    draft: '',
    status: 'playing',
    notice: null,
    constraints: ruleset.initialConstraints,
  };
}

/**
 * Replay a sequence of guesses to rebuild a session.
 *
 * Used to restore an in-progress game after a reload and to play the house
 * starter automatically. Guesses are trusted to have been legal when they were
 * made rather than re-validated, because the rules that admitted them are the
 * same rules being rebuilt.
 */
export function replaySession(
  answer: string,
  ruleset: Ruleset,
  guesses: readonly string[],
): GameSession {
  let session = createSession(answer, ruleset);
  for (const guess of guesses) {
    const pattern = computePattern(guess, answer);
    const played = [...session.guesses, guess];
    session = {
      ...session,
      guesses: played,
      patterns: [...session.patterns, pattern],
      constraints: ruleset.accumulate(session.constraints, { guess, pattern }),
      status:
        pattern === WIN_PATTERN ? 'won' : played.length >= MAX_GUESSES ? 'lost' : 'playing',
    };
  }
  return session;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'] as const;

/**
 * Which hard-mode rule the draft broke, in the player's terms.
 *
 * "Illegal in hard mode" is useless feedback when you cannot see which clue you
 * dropped. Reports the first broken rule, greens before required letters, the
 * way the player reads the board.
 */
function hardModeComplaint(session: GameSession, ruleset: Ruleset): string {
  const { greens, requiredLetters, requiredCounts } = session.constraints;
  const draft = session.draft;

  for (let position = 0; position < WORD_LENGTH; position += 1) {
    const required = greens[position]!;
    if (required >= 0 && draft.charCodeAt(position) - CODE_A !== required) {
      const letter = String.fromCharCode(CODE_A + required).toUpperCase();
      return `${ORDINALS[position]} letter must be ${letter}`;
    }
  }

  for (let index = 0; index < requiredLetters.length; index += 1) {
    const code = requiredLetters[index]!;
    const letter = String.fromCharCode(CODE_A + code);
    const needed = requiredCounts[index]!;
    const present = [...draft].filter((character) => character === letter).length;
    if (present < needed) {
      const name = letter.toUpperCase();
      return needed > 1
        ? `Guess must contain ${needed} ${name}s`
        : `Guess must contain ${name}`;
    }
  }

  // Unreachable while the only restricting ruleset is hard mode, but a future
  // ruleset should degrade to something honest rather than a wrong reason.
  return `Not legal in ${ruleset.mode} mode`;
}

function reject(session: GameSession, message: string): GameSession {
  return {
    ...session,
    notice: { message, nonce: (session.notice?.nonce ?? 0) + 1 },
  };
}

export function reduceGame(
  session: GameSession,
  action: GameAction,
  rules: GameRules,
): GameSession {
  if (action.type === 'dismissNotice') {
    return session.notice === null ? session : { ...session, notice: null };
  }

  if (session.status !== 'playing') {
    return session;
  }

  switch (action.type) {
    case 'letter': {
      const letter = action.letter.toLowerCase();
      if (!/^[a-z]$/.test(letter) || session.draft.length >= WORD_LENGTH) {
        return session;
      }
      return { ...session, draft: session.draft + letter, notice: null };
    }

    case 'backspace': {
      if (session.draft.length === 0) {
        return session;
      }
      return { ...session, draft: session.draft.slice(0, -1), notice: null };
    }

    case 'submit': {
      if (session.draft.length < WORD_LENGTH) {
        return reject(session, 'Not enough letters');
      }
      if (!rules.isAllowedWord(session.draft)) {
        // Spec §6: an unknown word costs no turn.
        return reject(session, 'Not in the word list');
      }
      if (!rules.ruleset.isLegal(session.constraints, session.draft)) {
        return reject(session, hardModeComplaint(session, rules.ruleset));
      }

      const pattern = computePattern(session.draft, session.answer);
      const guesses = [...session.guesses, session.draft];
      const patterns = [...session.patterns, pattern];
      const won = pattern === WIN_PATTERN;

      return {
        ...session,
        guesses,
        patterns,
        draft: '',
        notice: null,
        constraints: rules.ruleset.accumulate(session.constraints, {
          guess: session.draft,
          pattern,
        }),
        status: won ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing',
      };
    }

    default:
      return session;
  }
}

/**
 * The best-known state of every letter the player has used.
 *
 * Best-known, not latest: once a letter has shown green it stays green even if
 * a later guess puts it somewhere it does not belong.
 *
 * `throughGuess` caps how many guesses are taken into account, which lets the
 * keyboard hold still while the newest row is turning over — a key that changed
 * colour before its tile did would give the answer away early. The default is
 * every guess played, so nothing that does not care about the reveal has to say
 * so.
 */
export function keyboardState(
  session: GameSession,
  throughGuess = session.guesses.length,
): ReadonlyMap<string, Tile> {
  const best = new Map<string, Tile>();
  const considered = Math.max(0, Math.min(throughGuess, session.guesses.length));

  for (let index = 0; index < considered; index += 1) {
    const guess = session.guesses[index]!;
    const tiles = tilesFromPattern(session.patterns[index]!);
    for (let position = 0; position < guess.length; position += 1) {
      const letter = guess[position]!;
      const tile = tiles[position]!;
      const known = best.get(letter);
      if (known === undefined || tile > known) {
        best.set(letter, tile);
      }
    }
  }

  return best;
}

/** Rows to render: submitted guesses, then the draft, then blanks. */
export function boardRows(session: GameSession): readonly {
  readonly letters: readonly string[];
  readonly tiles: readonly Tile[] | null;
}[] {
  const rows: { letters: readonly string[]; tiles: readonly Tile[] | null }[] = [];

  for (let index = 0; index < session.guesses.length; index += 1) {
    rows.push({
      letters: [...session.guesses[index]!],
      tiles: tilesFromPattern(session.patterns[index]!),
    });
  }

  if (session.status === 'playing' && rows.length < MAX_GUESSES) {
    const letters = [...session.draft];
    while (letters.length < WORD_LENGTH) letters.push('');
    rows.push({ letters, tiles: null });
  }

  while (rows.length < MAX_GUESSES) {
    rows.push({ letters: Array.from({ length: WORD_LENGTH }, () => ''), tiles: null });
  }

  return rows;
}
