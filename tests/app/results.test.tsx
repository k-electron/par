/**
 * The results view, and the two tone rules that are design constraints rather
 * than preferences: never name a better word, never scold.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import * as copy from '../../src/app/copy/results';
import { createDirectScoringClient, scoreDirectly } from '../../src/app/scoring/direct';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { Results } from '../../src/app/ui/Results';
import { ScoringExplainer } from '../../src/app/ui/ScoringExplainer';
import { Repository, type ConfirmedSettings } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { PAR } from '../../src/engine/config/constants';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

const settings: ConfirmedSettings = { hardMode: false, useHouseStarter: true, confirmed: true };

function mountApp() {
  return render(
    <ThemeProvider theme={theme}>
      <App
        repository={new Repository(createMemoryStorage())}
        now={FIXED_NOW}
        scoring={createDirectScoringClient()}
      />
    </ThemeProvider>,
  );
}

afterEach(cleanup);

describe('the phrasing', () => {
  it('describes par in strokes, both directions', () => {
    expect(copy.parPhrase(2, 3.5, true)).toBe('1.5 strokes under par');
    expect(copy.parPhrase(5, 3.5, true)).toBe('1.5 strokes over par');
    expect(copy.parPhrase(4, 4, true)).toBe('level with par');
    expect(copy.parPhrase(3, 4, true)).toBe('a stroke under par');
  });

  it('treats being over par as ordinary, because it is', () => {
    // Par is anchored to strong play, so most players are over it most days.
    // The over-par phrasing must be as considered as the celebratory one.
    for (const guessesUsed of [4, 5, 6]) {
      const phrase = copy.parPhrase(guessesUsed, PAR, true);
      expect(phrase).toMatch(/over par|level with par/);
      expect(phrase).not.toMatch(/bad|poor|worse|fail/i);
    }
  });

  it('prices an unsolved game without scolding', () => {
    expect(copy.parPhrase(6, 3.5, false)).toContain('over par');
    expect(copy.headline(88, false)).toMatch(/read the position well/);
  });

  it('names a forced move as forced rather than as a triumph', () => {
    // Philosophy position 12: a player boxed into a coin flip played perfectly
    // and should be told so, not handed a silent 100 they appear to have earned.
    expect(copy.guessNote(100, true)).toMatch(/[Ff]orced/);
    expect(copy.guessNote(100, false)).not.toMatch(/[Ff]orced/);
  });

  it('reads the opener as unscored rather than as a zero', () => {
    expect(copy.guessNote(null, false)).toMatch(/not scored/i);
  });
});

describe('what the copy must never say', () => {
  const everything = Object.values(copy)
    .flatMap((value) => {
      if (typeof value === 'string') return [value];
      if (typeof value === 'object' && value !== null) return Object.values(value).flat();
      return [];
    })
    .filter((value): value is string => typeof value === 'string')
    .concat(
      // Every branch of every phrase function, not just the constants.
      [0, 40, 60, 80, 95, 100].flatMap((skill) => [
        copy.headline(skill, true),
        copy.headline(skill, false),
        copy.guessNote(skill, false),
        copy.guessNote(skill, true),
      ]),
      [-2, -0.5, 0, 0.5, 2].map((bits) => copy.luckNote(bits)),
    );

  it('never scolds', () => {
    // A bad guess is priced, never criticised.
    for (const phrase of everything) {
      expect(phrase, phrase).not.toMatch(
        /should have|shouldn't|mistake|wrong move|blunder|wasted|bad guess|poorly|too bad/i,
      );
    }
  });

  it('never points at a word the player did not play', () => {
    for (const phrase of everything) {
      expect(phrase, phrase).not.toMatch(/optimal|best word|correct word|better word|instead of/i);
    }
  });
});

describe('the rendered results', () => {
  const score = scoreDirectly({
    guesses: [PUZZLE.starter, 'crane', PUZZLE.answer],
    answer: PUZZLE.answer,
    tookHouseStarter: true,
    hardMode: false,
  });

  function renderResults() {
    return render(
      <ThemeProvider theme={theme}>
        <Results score={score} settings={settings} />
      </ThemeProvider>,
    );
  }

  it('leads with the total, then skill and par conversationally', () => {
    renderResults();

    expect(screen.getByText(score.total.toFixed(1))).toBeInTheDocument();
    expect(
      screen.getByText(/played at \d+%, .*(under par|over par|level with par)/),
    ).toBeInTheDocument();
  });

  it('shows a row per guess with its skill and luck', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    // A header row plus one per guess played.
    expect(within(table).getAllByRole('row')).toHaveLength(score.breakdown.length + 1);
  });

  it('shows the opener with no skill score', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const opener = within(table).getAllByRole('row')[1]!;
    expect(opener).toHaveTextContent(PUZZLE.starter);
    expect(opener).toHaveTextContent(/not scored/i);
  });

  it('badges the house starter and the outcome, and never as points', () => {
    renderResults();

    expect(screen.getByText('House starter')).toBeInTheDocument();
    expect(screen.getByText('Solved')).toBeInTheDocument();
    // The three named parts must still reconstruct the total exactly, so no
    // badge can have quietly become a bonus.
    expect(score.total).toBeCloseTo(score.skill + score.outcome + score.starterBonus, 10);
  });

  it('reports luck for the opener even though skill does not', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const opener = within(table).getAllByRole('row')[1]!;
    expect(opener).toHaveTextContent(/broke|ran/);
  });

  it('shows a working state rather than a blank while scoring', () => {
    render(
      <ThemeProvider theme={theme}>
        <Results score={null} settings={settings} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/working out your round/i)).toBeInTheDocument();
  });

  it('shows no five-letter word other than the ones played', () => {
    // Scoped to the breakdown's word cells rather than all rendered text: prose
    // legitimately contains words like "house" and "guess" that are also in a
    // 13,000-word dictionary, so scanning everything only produces noise. What
    // actually matters is that the column listing words lists exactly the
    // guesses played, and never an optimal play or a candidate.
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const shown = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('span')?.textContent ?? '');

    expect(shown).toEqual(score.breakdown.map((row) => row.guess));
  });

  it('is handed no word to leak in the first place', () => {
    // The strongest guarantee is structural: nothing in the score object names
    // a word beyond the guesses the player made, so no future component can
    // render one by accident.
    // Quoted tokens only, so JSON's own `false` is not mistaken for a word.
    const quoted = [...JSON.stringify(score).matchAll(/"([a-z]{5})"/g)].map((match) => match[1]!);
    const played = new Set(score.breakdown.map((row) => row.guess));
    const keys = new Set(['skill', 'total', 'guess', 'forced']);

    expect(quoted.filter((word) => !played.has(word) && !keys.has(word))).toEqual([]);
  });
});

describe('the explainer', () => {
  it('explains why a probe can beat a guess', async () => {
    render(
      <ThemeProvider theme={theme}>
        <ScoringExplainer open onClose={() => {}} />
      </ThemeProvider>,
    );

    expect(screen.getByText(/cannot possibly be the answer/i)).toBeInTheDocument();
    expect(screen.getByText(/never show you the word you should have played/i)).toBeInTheDocument();
  });

  it('is reachable from the results', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    await user.click(await screen.findByRole('button', { name: /how is this scored/i }));
    expect(await screen.findByText(/cannot possibly be the answer/i)).toBeInTheDocument();
  });
});

describe('scoring a finished game in the app', () => {
  it('shows a total once the game is won', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    expect(await screen.findByText(/played at \d+%/)).toBeInTheDocument();
  });

  it('matches what the engine computes directly', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard(`${PUZZLE.answer}{Enter}`);
    await screen.findByText(/played at \d+%/);

    const expected = scoreDirectly({
      guesses: [PUZZLE.starter, PUZZLE.answer],
      answer: PUZZLE.answer,
      tookHouseStarter: true,
      hardMode: false,
    });

    expect(screen.getByText(expected.total.toFixed(1))).toBeInTheDocument();
  });
});
