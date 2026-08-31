/**
 * The staggered tile reveal, and the line it must not cross.
 *
 * The reveal is decoration, so the rule is that it may delay how the board
 * *looks* and nothing else. A screen reader is not made to wait for a flip, a
 * reload mid-flip does not lose the turn, and the reducer never learns that an
 * animation exists.
 *
 * Run against an injected slow timing rather than fake clocks: `userEvent`
 * schedules its own work, and driving both from a mocked clock deadlocks. Real
 * timers with a deliberately generous window exercise exactly the same code and
 * leave room for a mid-flip assertion to land before the row settles.
 *
 * Everywhere else in the suite passes `INSTANT_REVEAL`, because a test about the
 * results view should not also be a test about how long it took to get there.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { createDirectScoringClient } from '../../src/app/scoring/direct';
import { keyboardState, replaySession } from '../../src/app/state/gameSession';
import { Repository, type ConfirmedSettings } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { GameScreen } from '../../src/app/ui/GameScreen';
import {
  INSTANT_REVEAL,
  REVEAL,
  revealDuration,
  type RevealTiming,
} from '../../src/app/ui/reveal';
import { answers, guesses as dictionary, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { WORD_LENGTH } from '../../src/engine/words/letters';
import { normalRuleset } from '../../src/engine/rules/ruleset';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

const settings: ConfirmedSettings = { hardMode: false, useHouseStarter: true, confirmed: true };
const rules = { isAllowedWord: (word: string) => dictionary.includes(word), ruleset: normalRuleset };

/**
 * Long enough that an assertion can run while a row is still turning, short
 * enough that a file of these tests stays quick.
 *
 * The headroom is deliberate. These tests score on the main thread, where the
 * shipped app uses a worker, and a real two-guess win takes about 150ms of
 * blocking work — which lands inside the reveal window, because the settle timer
 * now starts during the render that lands the guess rather than an effect later.
 * A window only a little longer than that work would pass or fail on how busy
 * the machine was.
 */
const SLOW: RevealTiming = { stagger: 200, flip: 200 };

/**
 * Every wait in this file is sized off the reveal itself.
 *
 * Testing library defaults to a second, which is shorter than a deliberately slow
 * reveal — so the defaults would time out on a working animation and the timing
 * above could not be tuned without silently breaking six tests.
 */
const PATIENCE = { timeout: revealDuration(SLOW) + 2_000 };

function mountApp(
  store = new Repository(createMemoryStorage()),
  scoring = createDirectScoringClient(),
) {
  render(
    <ThemeProvider theme={theme}>
      <App repository={store} now={FIXED_NOW} scoring={scoring} reveal={SLOW} />
    </ThemeProvider>,
  );
  return store;
}

/**
 * Mount with the score for a finished round already computed.
 *
 * These tests score on the calling thread, where the app uses a worker, and a
 * real round costs the engine a couple of seconds on a slow machine. Left until
 * the game ends, that work blocks inside the reveal and eats the window an
 * assertion needs — which passed locally and failed on CI, the worst way for a
 * test to be wrong.
 *
 * The client caches, so warming it here makes the call the app makes during the
 * flip a map lookup. The real scorer, the real numbers, none of the cost where it
 * would distort what is being measured.
 */
async function mountScored(played: readonly string[]) {
  const scoring = createDirectScoringClient();
  await scoring.score({
    guesses: played,
    answer: PUZZLE.answer,
    tookHouseStarter: true,
    hardMode: false,
  });
  return mountApp(new Repository(createMemoryStorage()), scoring);
}

const revealingRow = () => document.querySelector('[data-revealing="true"]');
const settled = () => waitFor(() => expect(revealingRow()).toBeNull(), PATIENCE);
const boardRow = (index: number) =>
  within(screen.getByRole('grid')).getAllByRole('row')[index]!;

afterEach(cleanup);

describe('a row turning over', () => {
  it('holds the score back until the last tile has landed', async () => {
    const user = userEvent.setup();
    await mountScored([PUZZLE.starter, PUZZLE.answer]);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settled();
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    // The guess has landed and the game is won, but the row is still turning.
    expect(revealingRow()).not.toBeNull();
    expect(screen.queryByText(/played at \d+%/)).not.toBeInTheDocument();

    expect(await screen.findByText(/played at \d+%/, {}, PATIENCE)).toBeInTheDocument();
    expect(revealingRow()).toBeNull();
  });

  /**
   * The crux of the design. Waiting is for the eye; anything read out or read by
   * a machine is true the instant the guess lands, so nobody using assistive
   * technology is held behind an animation they cannot see.
   */
  it('tells a screen reader everything before the animation finishes', async () => {
    const user = userEvent.setup();
    await mountScored([PUZZLE.starter, PUZZLE.answer]);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settled();
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    expect(revealingRow(), 'should still be mid-reveal').not.toBeNull();
    expect(boardRow(1).getAttribute('aria-label')).toMatch(/correct/);

    for (let column = 0; column < WORD_LENGTH; column += 1) {
      expect(screen.getByTestId(`tile-1-${column}`).getAttribute('data-state')).toMatch(/^[012]$/);
    }
  });

  /**
   * The celebration is decoration too, so it obeys the same rule as the score:
   * nothing about the ending appears over a row still turning over.
   */
  it('holds the confetti back until the last tile has landed', async () => {
    const user = userEvent.setup();
    await mountScored([PUZZLE.starter, PUZZLE.answer]);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settled();
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    expect(revealingRow(), 'should still be mid-reveal').not.toBeNull();
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();

    expect(await screen.findByTestId('confetti', {}, PATIENCE)).toBeInTheDocument();
  });

  it('leaves the keys alone until the row it belongs to has settled', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settled();

    // A guess that does not win, so the keyboard is still on screen afterwards,
    // and a letter of it the starter had not already accounted for.
    const probe = 'crane';
    expect(probe, 'probe must not end the game').not.toBe(PUZZLE.answer);
    const opened = keyboardState(replaySession(PUZZLE.answer, normalRuleset, [PUZZLE.starter]));
    const fresh = [...probe].find((letter) => !opened.has(letter));
    expect(fresh, 'fixture needs a letter the starter did not reveal').toBeDefined();

    const key = () => screen.getByRole('button', { name: new RegExp(`^${fresh}(,|$)`) });
    const plain = key().getAttribute('aria-label');

    await user.keyboard(`${probe}{Enter}`);
    expect(key().getAttribute('aria-label'), 'key moved before its tile did').toBe(plain);

    await waitFor(() => expect(key().getAttribute('aria-label')).not.toBe(plain), PATIENCE);
  });

  it('refuses a second guess mid-flip but still takes the letters', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settled();
    await user.keyboard('crane{Enter}');
    expect(revealingRow()).not.toBeNull();

    // Typing is never swallowed — the next guess can be composed while the
    // previous one turns — but it cannot be played onto a moving row.
    await user.keyboard('slate{Enter}');
    expect(screen.getByTestId('tile-2-0').textContent).toBe('s');
    expect(boardRow(2).getAttribute('aria-label'), 'row 2 was played mid-flip').toBe(null);

    await settled();
    await user.keyboard('{Enter}');
    await waitFor(
      () => expect(boardRow(2).getAttribute('aria-label')).toMatch(/word|correct/),
      PATIENCE,
    );
  });

  it('names the answer only once the losing row has finished', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <GameScreen
          answer={PUZZLE.answer}
          puzzleNumber={165}
          settings={settings}
          restoredGuesses={['crane', 'moist', 'pluck', 'begun', 'dwarf']}
          rules={rules}
          reveal={SLOW}
        />
      </ThemeProvider>,
    );

    await user.keyboard('skimp{Enter}');
    expect(screen.queryByText(/the answer was/i)).not.toBeInTheDocument();

    expect(await screen.findByText(/the answer was/i, {}, PATIENCE)).toBeInTheDocument();
    expect(screen.queryByTestId('confetti'), 'a loss is not celebrated').not.toBeInTheDocument();
  });
});

describe('which rows turn over', () => {
  it('turns the house starter over when the day is confirmed', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));

    // The blind bet turning face up is the one moment worth making a show of.
    expect(revealingRow()).not.toBeNull();
    await settled();
  });

  it('leaves a restored game settled', () => {
    // Those rows were revealed on an earlier visit. Replaying the animation
    // would claim they had just happened.
    const store = new Repository(createMemoryStorage());
    store.saveDay({
      puzzleNumber: PUZZLE.puzzleNumber,
      settings,
      guesses: [PUZZLE.starter, 'crane'],
      status: 'playing',
    });

    mountApp(store);

    expect(revealingRow()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the timing', () => {
  it('waits for every tile, not just the first', () => {
    // The last tile starts only after the others have been staggered past it.
    expect(revealDuration(REVEAL)).toBe((WORD_LENGTH - 1) * REVEAL.stagger + REVEAL.flip);
    expect(revealDuration(REVEAL)).toBeGreaterThan(REVEAL.flip);
  });

  it('collapses to nothing when asked for stillness', () => {
    expect(revealDuration(INSTANT_REVEAL)).toBe(0);
  });
});
