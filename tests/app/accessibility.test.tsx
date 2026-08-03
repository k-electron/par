/**
 * Spec §9's accessibility outcomes, and the appearance options.
 *
 * These are checks a real screen-reader or colourblind user would notice: an
 * announced result, a keyboard-operable board, tile state carried by something
 * other than colour, and a palette that can be swapped.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { createDirectScoringClient } from '../../src/app/scoring/direct';
import { Repository } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { DEFAULT_APPEARANCE, createAppTheme, tileColours } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

function mount(store = new Repository(createMemoryStorage())) {
  const rendered = render(
    <App repository={store} now={FIXED_NOW} scoring={createDirectScoringClient()} />,
  );
  return { ...rendered, store };
}

afterEach(cleanup);

describe('the palettes', () => {
  it('defaults to dark with the familiar tile colours', () => {
    expect(DEFAULT_APPEARANCE.appearance).toBe('dark');
    expect(createAppTheme(DEFAULT_APPEARANCE).palette.mode).toBe('dark');
  });

  it('offers a light theme', () => {
    expect(createAppTheme({ ...DEFAULT_APPEARANCE, appearance: 'light' }).palette.mode).toBe(
      'light',
    );
  });

  it('distinguishes present from correct without relying on green and yellow', () => {
    // Red-green colour blindness is the common form, and green/yellow is the
    // pairing it struggles with most. The accessible palette moves to orange
    // and blue, which differ in hue *and* in lightness.
    const classic = tileColours({ appearance: 'dark', tilePalette: 'classic' });
    const accessible = tileColours({ appearance: 'dark', tilePalette: 'accessible' });

    expect(accessible.present).not.toBe(classic.present);
    expect(accessible.correct).not.toBe(classic.correct);
    expect(accessible.present).not.toBe(accessible.correct);
  });

  it('changes tile colours through the theme, not the components', () => {
    // If a component hardcoded a colour the option could not work, so the theme
    // is where the palette has to live.
    for (const palette of ['classic', 'accessible'] as const) {
      const theme = createAppTheme({ appearance: 'dark', tilePalette: palette });
      expect(theme.tiles.correct).toBe(tileColours({ appearance: 'dark', tilePalette: palette }).correct);
    }
  });

  it('honours a reduced-motion preference globally', () => {
    // Set once on the baseline rather than per animation, so a future animation
    // cannot forget to respect it.
    const overrides = createAppTheme(DEFAULT_APPEARANCE).components?.MuiCssBaseline
      ?.styleOverrides;
    expect(JSON.stringify(overrides)).toContain('prefers-reduced-motion');
  });
});

describe('choosing an appearance', () => {
  it('remembers the choice across a reload', async () => {
    const user = userEvent.setup();
    const { store } = mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('switch', { name: 'High-contrast tiles' }));

    expect(store.loadAppearance().tilePalette).toBe('accessible');

    cleanup();
    mount(store);
    expect(store.loadAppearance().tilePalette).toBe('accessible');
  });

  it('offers both options from the board', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Appearance' }));

    expect(screen.getByRole('switch', { name: 'Light theme' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'High-contrast tiles' })).toBeInTheDocument();
  });
});

describe('what a screen reader gets', () => {
  it('announces each completed row as letters and their feedback', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));

    // The auto-played starter is already on the board and must be described.
    const rows = within(screen.getByRole('grid')).getAllByRole('row');
    const described = rows.filter((row) => row.getAttribute('aria-label') !== null);
    expect(described.length).toBeGreaterThan(0);
    expect(described[0]?.getAttribute('aria-label')).toMatch(
      /(not in the word|in the word|correct)/,
    );
  });

  it('carries tile state in the markup, not only in colour', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // A colourblind player without the alternate palette, and any automated
    // check, can still read the state.
    expect(screen.getByTestId('tile-0-0').getAttribute('data-state')).toMatch(/^[012]$/);
  });

  it('announces a rejected word politely rather than silently', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('zzzzz{Enter}');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/not in the word list/i);
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('labels every key with what is known about its letter', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // The starter has been played, so at least one key carries a hint.
    const hinted = screen
      .getAllByRole('button')
      .filter((button) => /^[a-z], (not )?in the word|correct$/.test(button.getAttribute('aria-label') ?? ''));
    expect(hinted.length).toBeGreaterThan(0);
  });

  it('names the game in exactly one top-level heading', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('operating it by keyboard alone', () => {
  /** Tab until `predicate` holds for the focused element, or give up. */
  async function tabTo(
    user: ReturnType<typeof userEvent.setup>,
    predicate: (element: Element) => boolean,
  ): Promise<Element | null> {
    for (let step = 0; step < 20; step += 1) {
      await user.tab();
      const focused = document.activeElement;
      if (focused !== null && predicate(focused)) return focused;
    }
    return null;
  }

  it('reaches and activates the settings gate without a pointer', async () => {
    const user = userEvent.setup();
    mount();

    const start = await tabTo(user, (element) => element.textContent === 'Start');
    expect(start).not.toBeNull();

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('plays a whole game from the physical keyboard', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    // No focus needed: the board listens at the window, so a player can just
    // start typing the way they would in any word game.
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    expect(await screen.findByText(/played at \d+%/)).toBeInTheDocument();
  });

  it('gives every control on the results screen a name and a tab stop', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);

    for (const button of screen.getAllByRole('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent ?? '';
      expect(name.trim(), button.outerHTML.slice(0, 80)).not.toBe('');
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
  });
});
