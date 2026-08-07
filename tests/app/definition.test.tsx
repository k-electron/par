/**
 * The offer to go and look the word up.
 *
 * Two surfaces show it — the round you just played and a round somebody sent you
 * — and they must send you to the same place, because it is the same word. The
 * label does not name it; the address does, which is why this only ever appears
 * on a finished round and, on a replay, behind the spoiler gate.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { definitionSearch } from '../../src/app/copy/results';
import { encodeSharedGame, type SharedGame } from '../../src/app/share/codec';
import { createDirectScoringClient } from '../../src/app/scoring/direct';
import { Repository, type ConfirmedSettings } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { INSTANT_REVEAL } from '../../src/app/ui/reveal';
import { WORD_LIST_VERSION, answers, guesses as dictionary, starters } from '../../src/data';
import { SCORER_VERSION } from '../../src/engine/config/constants';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const PUZZLE_NUMBER = 165;
const PUZZLE = drawPuzzle(PUZZLE_NUMBER, { answers, starters });
const FIXED_NOW = new Date('2026-06-15T16:00:00Z');

const settings: ConfirmedSettings = { hardMode: false, useHouseStarter: true, confirmed: true };

/** A round that ran out of guesses without ever playing the answer. */
const LOST = [PUZZLE.starter, 'crane', 'moist', 'pluck', 'begun', 'dwarf'];
const WON = [PUZZLE.starter, 'crane', PUZZLE.answer];

function shared(played: readonly string[]): SharedGame {
  return {
    puzzleNumber: PUZZLE_NUMBER,
    hardMode: false,
    tookHouseStarter: true,
    guessIndices: played.map((word) => dictionary.indexOf(word)),
    wordListVersion: WORD_LIST_VERSION,
    scorerVersion: SCORER_VERSION,
  };
}

function mount(hash?: string, store = new Repository(createMemoryStorage())) {
  render(
    <ThemeProvider theme={theme}>
      <App
        repository={store}
        now={FIXED_NOW}
        scoring={createDirectScoringClient()}
        reveal={INSTANT_REVEAL}
        {...(hash === undefined ? {} : { initialHash: hash })}
      />
    </ThemeProvider>,
  );
  return store;
}

/** A replay whose recipient has already finished that day, so no gate. */
function mountReplay(played: readonly string[]) {
  const store = new Repository(createMemoryStorage());
  store.saveDay({
    puzzleNumber: PUZZLE_NUMBER,
    settings,
    guesses: WON,
    status: 'won',
    completedAt: Date.now(),
  });
  return mount(`#r=${encodeSharedGame(shared(played))}`, store);
}

const definitionLink = () => screen.getByRole('link', { name: /what does .* mean\?/i });

afterEach(cleanup);

describe('looking the word up', () => {
  it('offers it once your own round is over', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('link', { name: /mean\?/i }), 'offered mid-game').toBeNull();

    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);

    expect(definitionLink()).toHaveAttribute('href', definitionSearch(PUZZLE.answer));
  });

  it('sends both surfaces to the same place, because it is the same word', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);
    const own = definitionLink().getAttribute('href');

    cleanup();
    mountReplay(WON);
    await screen.findByText(/played at \d+%/);

    expect(definitionLink().getAttribute('href')).toBe(own);
  });

  it('asks the question in words rather than sending a bare lookup', () => {
    // The whole sentence is the point: a search for "fixer" alone returns a film
    // and a magazine before it returns a meaning.
    const url = new URL(definitionSearch(PUZZLE.answer));
    expect(url.searchParams.get('q')).toBe(`what does ${PUZZLE.answer} mean?`);
  });

  it('opens away from the game, and cannot reach back into it', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);

    const link = definitionLink();
    expect(link).toHaveAttribute('target', '_blank');
    // Without noopener the new tab can steer this one through window.opener.
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('says "today" only about today', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);
    expect(definitionLink()).toHaveTextContent(/today/i);

    cleanup();
    // A round somebody sent could be from any day, so the same phrase would be
    // a small lie on the one screen that cannot know when it was played.
    mountReplay(WON);
    await screen.findByText(/played at \d+%/);
    expect(definitionLink()).not.toHaveTextContent(/today/i);
  });
});

describe('a replay of a round that was lost', () => {
  it('names the answer, which the board never does', async () => {
    mountReplay(LOST);
    await screen.findByText(/played at \d+%/);

    // Six wrong guesses and no winning row, so this screen is the only place the
    // word can come from — and it used to come from nowhere.
    expect(screen.getByText(new RegExp(`the answer was ${PUZZLE.answer}`, 'i'))).toBeInTheDocument();
    expect(definitionLink()).toHaveAttribute('href', definitionSearch(PUZZLE.answer));
  });

  it('says whose round ran out', async () => {
    mountReplay(LOST);
    await screen.findByText(/played at \d+%/);

    expect(screen.getByText(/they ran out of guesses/i)).toBeInTheDocument();
  });
});

describe('the spoiler gate', () => {
  it('withholds the word, and the way to look it up, until it is opened', async () => {
    const user = userEvent.setup();
    // A recipient with no record of that day is warned first.
    mount(`#r=${encodeSharedGame(shared(LOST))}`);

    expect(screen.getByText(/will spoil puzzle/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /mean\?/i })).toBeNull();
    expect(document.body.textContent?.toLowerCase()).not.toContain(PUZZLE.answer);

    await user.click(screen.getByRole('button', { name: /show me anyway/i }));
    await screen.findByText(/played at \d+%/);

    expect(definitionLink()).toBeInTheDocument();
  });
});
