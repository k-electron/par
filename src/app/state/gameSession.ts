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

import { Tile, WIN_PATTERN, computePattern, tilesFromPattern } from '../../engine/words/pattern';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

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
}

export function createSession(answer: string): GameSession {
  return {
    answer,
    guesses: [],
    patterns: [],
    draft: '',
    status: 'playing',
    notice: null,
  };
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
 */
export function keyboardState(session: GameSession): ReadonlyMap<string, Tile> {
  const best = new Map<string, Tile>();

  for (let index = 0; index < session.guesses.length; index += 1) {
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
