/**
 * The board's rules, exercised by playing games rather than rendering them.
 */

import { describe, expect, it } from 'vitest';

import {
  type GameAction,
  type GameRules,
  type GameSession,
  MAX_GUESSES,
  boardRows,
  createSession,
  keyboardState,
  reduceGame,
} from '../../src/app/state/gameSession';
import { Tile } from '../../src/engine/words/pattern';

// A deliberately tiny dictionary: 'zzzzz' is absent so it can stand in for
// anything the player types that is not a real word.
const rules: GameRules = {
  isAllowedWord: (word) => ['crane', 'slate', 'abide', 'speed', 'banal', 'annal'].includes(word),
};

function apply(session: GameSession, actions: readonly GameAction[]): GameSession {
  return actions.reduce((state, action) => reduceGame(state, action, rules), session);
}

function type(word: string): GameAction[] {
  return [...word].map((letter) => ({ type: 'letter', letter }) as GameAction);
}

function guess(word: string): GameAction[] {
  return [...type(word), { type: 'submit' }];
}

describe('typing', () => {
  it('accepts letters up to the word length and no further', () => {
    const session = apply(createSession('crane'), type('slateXY'));
    expect(session.draft).toBe('slate');
  });

  it('ignores anything that is not a letter', () => {
    const session = apply(createSession('crane'), [
      { type: 'letter', letter: '1' },
      { type: 'letter', letter: '-' },
      { type: 'letter', letter: 'ß' },
    ]);
    expect(session.draft).toBe('');
  });

  it('lowercases what it stores', () => {
    expect(apply(createSession('crane'), type('SLATE')).draft).toBe('slate');
  });

  it('deletes from the end and stops at empty', () => {
    const session = apply(createSession('crane'), [
      ...type('sla'),
      { type: 'backspace' },
      { type: 'backspace' },
      { type: 'backspace' },
      { type: 'backspace' },
    ]);
    expect(session.draft).toBe('');
  });
});

describe('rejecting a guess', () => {
  it('refuses a short word without spending a turn', () => {
    const session = apply(createSession('crane'), [...type('sla'), { type: 'submit' }]);
    expect(session.guesses).toEqual([]);
    expect(session.draft).toBe('sla');
    expect(session.notice?.message).toBe('Not enough letters');
  });

  it('refuses a word outside the list without spending a turn', () => {
    // Spec §6: words outside the dictionary are rejected without consuming a turn.
    const session = apply(createSession('crane'), guess('zzzzz'));
    expect(session.guesses).toEqual([]);
    expect(session.draft).toBe('zzzzz');
    expect(session.notice?.message).toBe('Not in the word list');
  });

  it('bumps the nonce each time so a repeated rejection still registers', () => {
    const once = apply(createSession('crane'), guess('zzzzz'));
    const twice = apply(once, [{ type: 'submit' }]);
    expect(twice.notice?.nonce).toBeGreaterThan(once.notice?.nonce ?? 0);
  });

  it('clears the notice as soon as the player types again', () => {
    const rejected = apply(createSession('crane'), guess('zzzzz'));
    expect(apply(rejected, [{ type: 'backspace' }]).notice).toBeNull();
  });
});

describe('playing to an end', () => {
  it('wins on the exact answer and stops accepting input', () => {
    const won = apply(createSession('crane'), guess('crane'));
    expect(won.status).toBe('won');
    expect(won.guesses).toEqual(['crane']);

    const after = apply(won, guess('slate'));
    expect(after).toBe(won);
  });

  it('loses after six wrong guesses and reveals nothing before then', () => {
    let session = createSession('crane');
    for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
      expect(session.status).toBe('playing');
      session = apply(session, guess('slate'));
    }
    expect(session.status).toBe('lost');
    expect(session.guesses).toHaveLength(MAX_GUESSES);
  });

  it('records feedback for each guess', () => {
    const session = apply(createSession('abide'), guess('speed'));
    // Spec §10's verified vector: SPEED against ABIDE is ⬜⬜🟨⬜🟨.
    expect(session.patterns).toEqual([1 * 9 + 1 * 1]);
  });
});

describe('the keyboard', () => {
  it('remembers the best state a letter has reached', () => {
    // BANAL against ANNAL is ⬜🟨🟩🟩🟩, so A shows both yellow and green.
    const session = apply(createSession('annal'), guess('banal'));
    const state = keyboardState(session);
    expect(state.get('a')).toBe(Tile.Correct);
    expect(state.get('b')).toBe(Tile.Absent);
    expect(state.get('n')).toBe(Tile.Correct);
  });

  it('does not downgrade a green after a later guess', () => {
    const session = apply(apply(createSession('annal'), guess('annal')), guess('banal'));
    expect(keyboardState(session).get('a')).toBe(Tile.Correct);
  });

  it('knows nothing before the first guess', () => {
    expect(keyboardState(createSession('crane')).size).toBe(0);
  });
});

describe('the rendered rows', () => {
  it('always offers six rows', () => {
    expect(boardRows(createSession('crane'))).toHaveLength(MAX_GUESSES);
  });

  it('shows the draft in the row after the last guess', () => {
    const session = apply(createSession('crane'), [...guess('slate'), ...type('ab')]);
    const rows = boardRows(session);
    expect(rows[0]?.tiles).not.toBeNull();
    expect(rows[1]?.letters).toEqual(['a', 'b', '', '', '']);
    expect(rows[1]?.tiles).toBeNull();
  });

  it('stops offering a draft row once the game is over', () => {
    const rows = boardRows(apply(createSession('crane'), guess('crane')));
    expect(rows[0]?.tiles).not.toBeNull();
    expect(rows[1]?.letters).toEqual(['', '', '', '', '']);
  });
});
