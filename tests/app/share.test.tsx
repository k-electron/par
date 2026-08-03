/**
 * Sharing has to spoil nothing on its face and reconstruct everything one click
 * deeper. Spec §7, and priority 3 in the specification's own ordering.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { decodeSharedGame, encodeSharedGame, type SharedGame } from '../../src/app/share/codec';
import { replayLink, shareText } from '../../src/app/share/share';
import { createDirectScoringClient, scoreDirectly } from '../../src/app/scoring/direct';
import { Repository } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { WORD_LIST_VERSION, answers, guesses as dictionary, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const PUZZLE_NUMBER = 165;
const PUZZLE = drawPuzzle(PUZZLE_NUMBER, { answers, starters });
const FIXED_NOW = new Date('2026-06-15T16:00:00Z');

const PLAYED = [PUZZLE.starter, 'crane', PUZZLE.answer];

const game: SharedGame = {
  puzzleNumber: PUZZLE_NUMBER,
  hardMode: false,
  tookHouseStarter: true,
  guessIndices: PLAYED.map((word) => dictionary.indexOf(word)),
  wordListVersion: WORD_LIST_VERSION,
};

afterEach(cleanup);

describe('the codec', () => {
  it('round-trips a game exactly', () => {
    const decoded = decodeSharedGame(encodeSharedGame(game));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.game.puzzleNumber).toBe(game.puzzleNumber);
    expect(decoded.game.hardMode).toBe(game.hardMode);
    expect(decoded.game.tookHouseStarter).toBe(game.tookHouseStarter);
    expect(decoded.game.guessIndices).toEqual(game.guessIndices);
  });

  it('round-trips every combination of the flags', () => {
    for (const hardMode of [false, true]) {
      for (const tookHouseStarter of [false, true]) {
        const decoded = decodeSharedGame(
          encodeSharedGame({ ...game, hardMode, tookHouseStarter }),
        );
        expect(decoded.ok).toBe(true);
        if (decoded.ok) {
          expect([decoded.game.hardMode, decoded.game.tookHouseStarter]).toEqual([
            hardMode,
            tookHouseStarter,
          ]);
        }
      }
    }
  });

  it('round-trips one guess and six guesses', () => {
    for (const length of [1, 6]) {
      const indices = Array.from({ length }, (_, index) => index * 1000);
      const decoded = decodeSharedGame(encodeSharedGame({ ...game, guessIndices: indices }));
      expect(decoded.ok && decoded.game.guessIndices).toEqual(indices);
    }
  });

  it('round-trips the highest dictionary index', () => {
    const last = dictionary.length - 1;
    const decoded = decodeSharedGame(encodeSharedGame({ ...game, guessIndices: [last] }));
    expect(decoded.ok && decoded.game.guessIndices).toEqual([last]);
  });

  it('is stable — the same game always encodes the same way', () => {
    expect(encodeSharedGame(game)).toBe(encodeSharedGame(game));
  });

  it('produces something short enough to survive a chat client', () => {
    expect(encodeSharedGame(game).length).toBeLessThan(40);
  });
});

describe('what the link must not reveal', () => {
  const encoded = encodeSharedGame(game);

  it('contains no word that was played, and not the answer', () => {
    // Chat clients unfurl URLs. Nobody should learn the answer from a preview.
    for (const word of [...PLAYED, PUZZLE.answer, PUZZLE.starter]) {
      expect(encoded.toLowerCase()).not.toContain(word);
    }
  });

  it('contains no five-letter dictionary word at all', () => {
    const lower = encoded.toLowerCase();
    const leaked = dictionary.filter((word) => lower.includes(word));
    expect(leaked).toEqual([]);
  });

  it('hides the guess indices from plain reading', () => {
    // The masking is only there so the payload does not read as structured
    // data at a glance. It is spoiler-prevention, not security.
    for (const index of game.guessIndices) {
      expect(encoded).not.toContain(String(index));
    }
  });
});

describe('malformed links', () => {
  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['version prefix only', WORD_LIST_VERSION.slice(0, 6)],
    ['not in the alphabet', `${WORD_LIST_VERSION.slice(0, 6)}!!!!!!!!`],
    ['truncated', encodeSharedGame(game).slice(0, 10)],
    ['corrupted body', `${encodeSharedGame(game).slice(0, -1)}Z`],
  ])('fails gracefully on %s input', (_label, text) => {
    const decoded = decodeSharedGame(text);
    expect(decoded.ok).toBe(false);
  });

  it('never throws, whatever it is handed', () => {
    for (const text of ['', '#', 'r=', '\u0000', 'x'.repeat(500)]) {
      expect(() => decodeSharedGame(text)).not.toThrow();
    }
  });
});

describe('the shared text', () => {
  const score = scoreDirectly({
    guesses: PLAYED,
    answer: PUZZLE.answer,
    tookHouseStarter: true,
    hardMode: false,
  });

  const input = {
    puzzleNumber: PUZZLE_NUMBER,
    score,
    hardMode: false,
    tookHouseStarter: true,
    guessIndices: game.guessIndices,
    wordListVersion: WORD_LIST_VERSION,
    origin: 'https://par.pages.dev/',
  };

  it('shows an emoji grid, one row per guess', () => {
    const text = shareText(input);
    const rows = text.split('\n').filter((line) => /^[\u2B1C\u{1F7E8}\u{1F7E9}]+$/u.test(line));

    expect(rows).toHaveLength(score.breakdown.length);
    for (const row of rows) expect([...row]).toHaveLength(5);
  });

  it('names no word anywhere', () => {
    const text = shareText(input).toLowerCase();
    for (const word of [...PLAYED, PUZZLE.answer]) {
      expect(text).not.toContain(word);
    }
  });

  it('carries the score and the badges', () => {
    const text = shareText(input);
    expect(text).toContain(`Par ${PUZZLE_NUMBER}`);
    expect(text).toContain(score.total.toFixed(1));
    expect(text).toContain('house starter');
  });

  it('marks an unsolved game X/6 without naming the answer', () => {
    const lost = scoreDirectly({
      guesses: ['crane', 'slate', 'plumb', 'shirt', 'grove', 'stomp'],
      answer: PUZZLE.answer,
      tookHouseStarter: false,
      hardMode: false,
    });
    const text = shareText({ ...input, score: lost, tookHouseStarter: false });

    expect(text).toContain('X/6');
    expect(text.toLowerCase()).not.toContain(PUZZLE.answer);
  });

  it('puts the payload in the fragment so no server ever sees it', () => {
    expect(replayLink(input)).toMatch(/#r=/);
  });
});

describe('the spoiler gate', () => {
  function mountReplay(store: Repository) {
    return render(
      <ThemeProvider theme={theme}>
        <App
          repository={store}
          now={FIXED_NOW}
          scoring={createDirectScoringClient()}
          initialHash={`#r=${encodeSharedGame(game)}`}
        />
      </ThemeProvider>,
    );
  }

  it('warns somebody who has not finished that day', () => {
    const { container } = mountReplay(new Repository(createMemoryStorage()));

    expect(screen.getByText(/will spoil puzzle/i)).toBeInTheDocument();
    // Nothing of the game may be on screen behind the warning.
    expect(container.textContent?.toLowerCase()).not.toContain(PUZZLE.answer);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('lets them back out to play it themselves', async () => {
    const user = userEvent.setup();
    mountReplay(new Repository(createMemoryStorage()));

    await user.click(screen.getByRole('button', { name: /let me play it first/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('is a confirmation, not a wall', async () => {
    const user = userEvent.setup();
    mountReplay(new Repository(createMemoryStorage()));

    await user.click(screen.getByRole('button', { name: /show me anyway/i }));
    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('does not warn somebody who already finished that day', () => {
    const store = new Repository(createMemoryStorage());
    store.saveDay({
      puzzleNumber: PUZZLE_NUMBER,
      settings: { hardMode: false, useHouseStarter: true, confirmed: true },
      guesses: PLAYED,
      status: 'won',
      completedAt: Date.now(),
    });

    mountReplay(store);
    expect(screen.queryByText(/will spoil/i)).not.toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});

describe('the replay itself', () => {
  function mountRevealed() {
    const store = new Repository(createMemoryStorage());
    store.saveDay({
      puzzleNumber: PUZZLE_NUMBER,
      settings: { hardMode: false, useHouseStarter: true, confirmed: true },
      guesses: PLAYED,
      status: 'won',
      completedAt: Date.now(),
    });

    return render(
      <ThemeProvider theme={theme}>
        <App
          repository={store}
          now={FIXED_NOW}
          scoring={createDirectScoringClient()}
          initialHash={`#r=${encodeSharedGame(game)}`}
        />
      </ThemeProvider>,
    );
  }

  it('rebuilds the sender\u2019s board', () => {
    mountRevealed();

    for (const [row, word] of PLAYED.entries()) {
      const shown = [0, 1, 2, 3, 4]
        .map((column) => screen.getByTestId(`tile-${row}-${column}`).textContent)
        .join('');
      expect(shown).toBe(word);
    }
  });

  it('recomputes the sender\u2019s total exactly', async () => {
    mountRevealed();

    // Recomputed from scratch on this machine, not carried in the link. If these
    // disagreed, comparing scores with a friend would be meaningless.
    const expected = scoreDirectly({
      guesses: PLAYED,
      answer: PUZZLE.answer,
      tookHouseStarter: true,
      hardMode: false,
    });

    expect(await screen.findByText(expected.total.toFixed(1))).toBeInTheDocument();
  });

  it('shows the play-by-play with skill and luck', async () => {
    mountRevealed();

    const table = await screen.findByRole('table', { name: /guess by guess/i });
    expect(table).toHaveTextContent(/not scored/i);
    expect(table).toHaveTextContent(/broke|ran/);
  });

  it('offers a way out to the recipient\u2019s own game', async () => {
    const user = userEvent.setup();
    mountRevealed();

    await user.click(await screen.findByRole('button', { name: /play today/i }));

    // This fixture's recipient has already finished the same day, so leaving the
    // replay lands on their own completed game rather than a settings gate.
    expect(await screen.findByRole('heading', { level: 1, name: 'PAR' })).toBeInTheDocument();
    expect(screen.queryByText(/somebody.s round/i)).not.toBeInTheDocument();
  });
});
