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
  replaySession,
} from '../../src/app/state/gameSession';
import { hardRuleset, normalRuleset } from '../../src/engine/rules/ruleset';
import { Tile } from '../../src/engine/words/pattern';

const WORDS = ['crane', 'slate', 'abide', 'speed', 'banal', 'annal', 'crony', 'stern'];

// A deliberately tiny dictionary: 'zzzzz' is absent so it can stand in for
// anything the player types that is not a real word.
const rules: GameRules = {
  isAllowedWord: (word) => WORDS.includes(word),
  ruleset: normalRuleset,
};

const hardRules: GameRules = {
  isAllowedWord: (word) => WORDS.includes(word),
  ruleset: hardRuleset,
};

function apply(
  session: GameSession,
  actions: readonly GameAction[],
  using: GameRules = rules,
): GameSession {
  return actions.reduce((state, action) => reduceGame(state, action, using), session);
}

function newGame(answer: string, using: GameRules = rules): GameSession {
  return createSession(answer, using.ruleset);
}

function type(word: string): GameAction[] {
  return [...word].map((letter) => ({ type: 'letter', letter }) as GameAction);
}

function guess(word: string): GameAction[] {
  return [...type(word), { type: 'submit' }];
}

describe('typing', () => {
  it('accepts letters up to the word length and no further', () => {
    const session = apply(newGame('crane'), type('slateXY'));
    expect(session.draft).toBe('slate');
  });

  it('ignores anything that is not a letter', () => {
    const session = apply(newGame('crane'), [
      { type: 'letter', letter: '1' },
      { type: 'letter', letter: '-' },
      { type: 'letter', letter: 'ß' },
    ]);
    expect(session.draft).toBe('');
  });

  it('lowercases what it stores', () => {
    expect(apply(newGame('crane'), type('SLATE')).draft).toBe('slate');
  });

  it('deletes from the end and stops at empty', () => {
    const session = apply(newGame('crane'), [
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
    const session = apply(newGame('crane'), [...type('sla'), { type: 'submit' }]);
    expect(session.guesses).toEqual([]);
    expect(session.draft).toBe('sla');
    expect(session.notice?.message).toBe('Not enough letters');
  });

  it('refuses a word outside the list without spending a turn', () => {
    // Spec §6: words outside the dictionary are rejected without consuming a turn.
    const session = apply(newGame('crane'), guess('zzzzz'));
    expect(session.guesses).toEqual([]);
    expect(session.draft).toBe('zzzzz');
    expect(session.notice?.message).toBe('Not in the word list');
  });

  it('bumps the nonce each time so a repeated rejection still registers', () => {
    const once = apply(newGame('crane'), guess('zzzzz'));
    const twice = apply(once, [{ type: 'submit' }]);
    expect(twice.notice?.nonce).toBeGreaterThan(once.notice?.nonce ?? 0);
  });

  it('clears the notice as soon as the player types again', () => {
    const rejected = apply(newGame('crane'), guess('zzzzz'));
    expect(apply(rejected, [{ type: 'backspace' }]).notice).toBeNull();
  });
});

describe('playing to an end', () => {
  it('wins on the exact answer and stops accepting input', () => {
    const won = apply(newGame('crane'), guess('crane'));
    expect(won.status).toBe('won');
    expect(won.guesses).toEqual(['crane']);

    const after = apply(won, guess('slate'));
    expect(after).toBe(won);
  });

  it('loses after six wrong guesses and reveals nothing before then', () => {
    let session = newGame('crane');
    for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
      expect(session.status).toBe('playing');
      session = apply(session, guess('slate'));
    }
    expect(session.status).toBe('lost');
    expect(session.guesses).toHaveLength(MAX_GUESSES);
  });

  it('records feedback for each guess', () => {
    const session = apply(newGame('abide'), guess('speed'));
    // Spec §10's verified vector: SPEED against ABIDE is ⬜⬜🟨⬜🟨.
    expect(session.patterns).toEqual([1 * 9 + 1 * 1]);
  });
});

describe('hard mode', () => {
  it('lets anything through on the opening guess', () => {
    // Spec §6: legality applies from guess 2 onward.
    const session = apply(newGame('crane', hardRules), guess('speed'), hardRules);
    expect(session.guesses).toEqual(['speed']);
  });

  it('requires a revealed green in its position', () => {
    // CRONY against CRANE greens C, R and the final position is not E, so a
    // follow-up must keep C and R where they are.
    const opened = apply(newGame('crane', hardRules), guess('crony'), hardRules);
    const rejected = apply(opened, guess('slate'), hardRules);

    expect(rejected.guesses).toEqual(['crony']);
    expect(rejected.notice?.message).toBe('1st letter must be C');
  });

  it('requires a revealed letter to be reused', () => {
    // STERN against ABIDE reveals nothing; use SPEED against ABIDE, which
    // yellows E and D, so the next guess must contain both.
    const opened = apply(newGame('abide', hardRules), guess('speed'), hardRules);
    const rejected = apply(opened, guess('crony'), hardRules);

    expect(rejected.guesses).toEqual(['speed']);
    expect(rejected.notice?.message).toMatch(/^Guess must contain [ED]$/);
  });

  it('costs no turn when it rejects', () => {
    const opened = apply(newGame('crane', hardRules), guess('crony'), hardRules);
    const rejected = apply(opened, guess('slate'), hardRules);
    expect(rejected.guesses).toHaveLength(1);
    expect(rejected.draft).toBe('slate');
  });

  it('accepts a guess that honours every clue', () => {
    const opened = apply(newGame('crane', hardRules), guess('crony'), hardRules);
    const accepted = apply(opened, guess('crane'), hardRules);
    expect(accepted.status).toBe('won');
  });

  it('applies to the house starter\u2019s clues too', () => {
    // A starter played automatically as guess 1 constrains guess 2 exactly as a
    // typed opener would (spec §6).
    const afterStarter = replaySession('crane', hardRuleset, ['crony']);
    const rejected = apply(afterStarter, guess('slate'), hardRules);
    expect(rejected.notice?.message).toBe('1st letter must be C');
  });

  it('leaves normal mode unrestricted', () => {
    const opened = apply(newGame('crane'), guess('crony'));
    expect(apply(opened, guess('slate')).guesses).toEqual(['crony', 'slate']);
  });
});

describe('replaying a session', () => {
  it('rebuilds the board from guesses alone', () => {
    const replayed = replaySession('crane', normalRuleset, ['slate', 'crane']);
    expect(replayed.status).toBe('won');
    expect(replayed.guesses).toEqual(['slate', 'crane']);
    expect(replayed.patterns).toHaveLength(2);
  });

  it('matches a game played move by move', () => {
    const played = apply(newGame('abide'), [...guess('speed'), ...guess('slate')]);
    const replayed = replaySession('abide', normalRuleset, ['speed', 'slate']);
    expect(replayed.patterns).toEqual(played.patterns);
    expect(keyboardState(replayed)).toEqual(keyboardState(played));
  });

  it('rebuilds hard-mode constraints, not just the tiles', () => {
    const replayed = replaySession('crane', hardRuleset, ['crony']);
    expect(reduceGame(replayed, { type: 'submit' }, hardRules).notice).not.toBeNull();
  });

  it('reports a loss after six replayed guesses', () => {
    const replayed = replaySession('crane', normalRuleset, Array(MAX_GUESSES).fill('slate'));
    expect(replayed.status).toBe('lost');
  });
});

describe('the keyboard', () => {
  it('remembers the best state a letter has reached', () => {
    // BANAL against ANNAL is ⬜🟨🟩🟩🟩, so A shows both yellow and green.
    const session = apply(newGame('annal'), guess('banal'));
    const state = keyboardState(session);
    expect(state.get('a')).toBe(Tile.Correct);
    expect(state.get('b')).toBe(Tile.Absent);
    expect(state.get('n')).toBe(Tile.Correct);
  });

  it('does not downgrade a green after a later guess', () => {
    const session = apply(apply(newGame('annal'), guess('annal')), guess('banal'));
    expect(keyboardState(session).get('a')).toBe(Tile.Correct);
  });

  it('knows nothing before the first guess', () => {
    expect(keyboardState(newGame('crane')).size).toBe(0);
  });
});

describe('the rendered rows', () => {
  it('always offers six rows', () => {
    expect(boardRows(newGame('crane'))).toHaveLength(MAX_GUESSES);
  });

  it('shows the draft in the row after the last guess', () => {
    const session = apply(newGame('crane'), [...guess('slate'), ...type('ab')]);
    const rows = boardRows(session);
    expect(rows[0]?.tiles).not.toBeNull();
    expect(rows[1]?.letters).toEqual(['a', 'b', '', '', '']);
    expect(rows[1]?.tiles).toBeNull();
  });

  it('stops offering a draft row once the game is over', () => {
    const rows = boardRows(apply(newGame('crane'), guess('crane')));
    expect(rows[0]?.tiles).not.toBeNull();
    expect(rows[1]?.letters).toEqual(['', '', '', '', '']);
  });
});
