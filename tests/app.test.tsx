/**
 * The app end to end at the component level: today's real puzzle, the real
 * dictionary, and a game played through the keyboard the way a player would.
 */

import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { theme } from '../src/app/theme/theme';
import { App } from '../src/app/ui/App';
import { GameScreen } from '../src/app/ui/GameScreen';
import { MAX_GUESSES } from '../src/app/state/gameSession';

function renderWithTheme(node: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

const rules = {
  isAllowedWord: (word: string) => ['crane', 'slate', 'abide', 'speed'].includes(word),
};

function renderGame(answer: string) {
  return renderWithTheme(<GameScreen answer={answer} puzzleNumber={42} rules={rules} />);
}

function tile(row: number, column: number): HTMLElement {
  return screen.getByTestId(`tile-${row}-${column}`);
}

function rowText(row: number): string {
  return [0, 1, 2, 3, 4].map((column) => tile(row, column).textContent).join('');
}

describe('the app', () => {
  it('renders today\u2019s puzzle inside a main landmark', () => {
    renderWithTheme(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PAR');
    expect(screen.getByRole('grid', { name: 'Guesses' })).toBeInTheDocument();
  });

  it('offers a full six-row board and a letter keyboard', () => {
    renderWithTheme(<App />);

    expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(MAX_GUESSES);
    expect(screen.getByRole('button', { name: 'Submit guess' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete letter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'q' })).toBeInTheDocument();
  });

  it('does not reveal the answer while the game is in play', () => {
    renderWithTheme(<App />);

    // The starter is drawn but unused this increment, and the answer must not
    // be sitting in the markup for anyone who opens the inspector mid-game.
    expect(screen.getByRole('grid').textContent).toBe('');
  });
});

describe('playing with the physical keyboard', () => {
  it('types, deletes and shows letters on the board', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.keyboard('slat');
    expect(rowText(0)).toBe('slat');

    await user.keyboard('{Backspace}');
    expect(rowText(0)).toBe('sla');
  });

  it('plays a game to a win', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.keyboard('slate{Enter}');
    expect(rowText(0)).toBe('slate');

    await user.keyboard('crane{Enter}');
    expect(rowText(1)).toBe('crane');
    expect(await screen.findByText(/Solved in 2 of 6/)).toBeInTheDocument();

    // The board stops accepting input once the game is over.
    await user.keyboard('slate');
    expect(rowText(2)).toBe('');
  });

  it('plays a game to a loss and only then names the answer', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
      expect(screen.queryByText(/Out of guesses/)).not.toBeInTheDocument();
      await user.keyboard('slate{Enter}');
    }

    expect(await screen.findByText(/Out of guesses/)).toHaveTextContent('CRANE');
  });

  it('rejects a word outside the list without spending a turn', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.keyboard('abcde{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent('Not in the word list');
    // Still on the first row, with the guess intact for editing.
    expect(rowText(0)).toBe('abcde');
  });

  it('rejects a short word without spending a turn', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.keyboard('sla{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent('Not enough letters');
    expect(rowText(0)).toBe('sla');
  });

  it('leaves browser shortcuts alone', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.keyboard('{Control>}a{/Control}');
    expect(rowText(0)).toBe('');
  });
});

describe('playing with the on-screen keyboard', () => {
  it('accepts taps and colours the keys by what is known', async () => {
    const user = userEvent.setup();
    renderGame('abide');

    for (const letter of ['s', 'p', 'e', 'e', 'd']) {
      await user.click(screen.getByRole('button', { name: letter }));
    }
    await user.click(screen.getByRole('button', { name: 'Submit guess' }));

    expect(rowText(0)).toBe('speed');
    // SPEED against ABIDE is grey grey yellow grey yellow, so E and D are known
    // to be in the word and S and P are known not to be.
    expect(screen.getByRole('button', { name: 'e, in the word' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'd, in the word' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 's, not in the word' })).toBeInTheDocument();
  });

  it('deletes with the on-screen backspace', async () => {
    const user = userEvent.setup();
    renderGame('crane');

    await user.click(screen.getByRole('button', { name: 'c' }));
    await user.click(screen.getByRole('button', { name: 'r' }));
    await user.click(screen.getByRole('button', { name: 'Delete letter' }));

    expect(rowText(0)).toBe('c');
  });
});

describe('screen reader output', () => {
  it('describes each completed row as letters and their feedback', async () => {
    const user = userEvent.setup();
    renderGame('abide');

    await user.keyboard('speed{Enter}');

    expect(
      screen.getByRole('row', {
        name: 'S not in the word, P not in the word, E in the word, wrong place, E not in the word, D in the word, wrong place',
      }),
    ).toBeInTheDocument();
  });
});
