/**
 * Spec §6 and philosophy position 3: the settings confirm exists to make the
 * house-starter bet blind, and the lock exists to keep it that way.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Repository } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

// A fixed instant so the puzzle, and therefore the starter, never moves.
const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

function mount(repository: Repository) {
  return render(
    <ThemeProvider theme={theme}>
      <App repository={repository} now={FIXED_NOW} />
    </ThemeProvider>,
  );
}

function freshRepository() {
  return new Repository(createMemoryStorage());
}

afterEach(cleanup);

describe('the daily confirm', () => {
  it('blocks play until the player commits', () => {
    mount(freshRepository());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Guesses' })).not.toBeInTheDocument();
  });

  it('never shows the day\u2019s starter before the choice is made', () => {
    const { container } = mount(freshRepository());

    // The load-bearing detail of the whole mechanic: seeing the starter first
    // would turn a blind bet into a free look.
    expect(container.textContent?.toLowerCase()).not.toContain(PUZZLE.starter);
  });

  it('cannot be escaped or dismissed without choosing', async () => {
    const user = userEvent.setup();
    mount(freshRepository());

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(document.querySelector('.MuiBackdrop-root') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pre-fills from remembered preferences so a regular clicks through', () => {
    const store = freshRepository();
    store.savePreferences({ hardMode: true, useHouseStarter: false });
    mount(store);

    expect(screen.getByRole('switch', { name: 'Hard mode' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Use the house starter' })).not.toBeChecked();
  });

  it('remembers the choice for future days', async () => {
    const user = userEvent.setup();
    const store = freshRepository();
    mount(store);

    await user.click(screen.getByRole('switch', { name: 'Hard mode' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(store.loadPreferences()).toEqual({ hardMode: true, useHouseStarter: true });
  });
});

describe('taking the house starter', () => {
  it('plays it as guess one, revealing it only then', async () => {
    const user = userEvent.setup();
    mount(freshRepository());

    await user.click(screen.getByRole('button', { name: 'Start' }));

    const firstRow = [0, 1, 2, 3, 4]
      .map((column) => screen.getByTestId(`tile-0-${column}`).textContent)
      .join('');
    expect(firstRow).toBe(PUZZLE.starter);
  });

  it('leaves the board empty when the player declines it', async () => {
    const user = userEvent.setup();
    mount(freshRepository());

    await user.click(screen.getByRole('switch', { name: 'Use the house starter' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByTestId('tile-0-0').textContent).toBe('');
  });
});

describe('the lock', () => {
  it('replaces the toggles with locked, explained chips', async () => {
    const user = userEvent.setup();
    mount(freshRepository());

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/House starter/)).toBeInTheDocument();
    expect(screen.getByText(/Normal mode/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Why are these locked?' }));
    expect(await screen.findByText(/would turn it into free money/)).toBeInTheDocument();
  });

  it('holds across a reload', async () => {
    const user = userEvent.setup();
    const store = freshRepository();

    mount(store);
    await user.click(screen.getByRole('switch', { name: 'Hard mode' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    cleanup();

    // Same storage, fresh mount: the confirm must not reappear, because a
    // reload is exactly how you would escape a choice you regretted.
    mount(store);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Hard mode/)).toBeInTheDocument();
  });
});

describe('an in-progress game', () => {
  it('comes back exactly after a reload', async () => {
    const user = userEvent.setup();
    const store = freshRepository();

    mount(store);
    await user.click(screen.getByRole('switch', { name: 'Use the house starter' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('crane{Enter}');
    await user.keyboard('sl');
    cleanup();

    mount(store);

    const restored = [0, 1, 2, 3, 4]
      .map((column) => screen.getByTestId(`tile-0-${column}`).textContent)
      .join('');
    expect(restored).toBe('crane');
    // The draft is deliberately not persisted — only completed guesses are.
    expect(screen.getByTestId('tile-1-0').textContent).toBe('');
    // Keyboard state is rebuilt from the replayed guesses, not stored.
    expect(screen.getByRole('button', { name: /^c(,|$)/ })).toBeInTheDocument();
  });

  it('keeps playing when storage refuses to save', async () => {
    const user = userEvent.setup();
    const store = new Repository({
      read: () => null,
      write: () => {
        throw new Error('quota exceeded');
      },
      remove: () => undefined,
      keys: () => [],
    });

    mount(store);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('crane{Enter}');

    expect(screen.getByRole('grid', { name: 'Guesses' })).toBeInTheDocument();
  });
});
