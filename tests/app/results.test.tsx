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
import { INSTANT_REVEAL } from '../../src/app/ui/reveal';
import { ScoringExplainer } from '../../src/app/ui/ScoringExplainer';
import { Repository, type ConfirmedSettings } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { PAR } from '../../src/engine/config/constants';
import { WIN_PATTERN } from '../../src/engine/words/pattern';

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
        // These are about what the results say, not about the wait before they
        // appear. The reveal has its own file.
        reveal={INSTANT_REVEAL}
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
    expect(copy.guessNote(100, true, 3, 8)).toMatch(/[Ff]orced/);
    expect(copy.guessNote(100, false, 3, 8)).not.toMatch(/[Ff]orced/);
  });

  it('reads the opener as unscored rather than as a zero', () => {
    expect(copy.guessNote(null, false, 1, 3000)).toMatch(/opener/i);
  });

  it('never calls a later guess the opener', () => {
    // Spec §3 scores a guess facing one candidate 100 with zero weight, so the
    // sixth row reports a score rather than a blank. Whatever it says, it must
    // not claim to be the opener.
    expect(copy.guessNote(100, true, 6, 1)).not.toMatch(/opener/i);
    expect(copy.guessNote(null, false, 6, 1)).not.toMatch(/opener/i);
  });

  it('explains a guess that had only one word left to play', () => {
    expect(copy.guessNote(100, true, 6, 1)).toMatch(/one word left/i);
  });
});

/**
 * The light reports the share of the standing uncertainty a guess cleared, which
 * is what lets one measure answer for the size of the cut, its proportion, and
 * how far into the round it happened.
 */
describe('the progress light', () => {
  const level = (before: number, after: number) => copy.progressLevel(before, after, false);

  it('rates a cut against how much there was left to find out', () => {
    // Both halve the field. Against the uncertainty each faced, the first is a
    // twelfth of the way home and the second is the whole of it.
    expect(level(3000, 1500)).toBe('slight');
    expect(level(2, 1)).toBe('major');
  });

  it('gives a big count of words no credit on its own', () => {
    // A hundred words struck off a wide field is barely a step.
    expect(level(3000, 2900)).toBe('slight');
    // The same hundred, when a hundred and one was all there was, finishes it.
    expect(level(101, 1)).toBe('major');
  });

  it('bands at a half and a quarter of the uncertainty', () => {
    // 100 -> 10 removes exactly half: log2(10) is half of log2(100).
    expect(level(100, 10)).toBe('major');
    expect(level(100, 11)).toBe('minor');
    // 10000 -> 1000 removes a quarter: log2(1000) is three quarters of log2(10000).
    expect(level(10000, 1000)).toBe('minor');
    expect(level(10000, 1100)).toBe('slight');
  });

  it('never separates a cut of nothing from a small one', () => {
    // A word still possible always eliminates itself when it fails, so a row
    // that singled out "ruled nothing out" would prove the guess was never a
    // possible answer. Both ends of the band read the same.
    expect(level(9, 9)).toBe(level(9, 8));
    expect(copy.PROGRESS[level(9, 9)]).toMatch(/little or nothing/);
  });

  it('shows no light where there was no uncertainty to remove', () => {
    // The scorer prices these at 100 with zero weight. A red mark beside that
    // would be a verdict the game does not hold.
    expect(level(1, 1)).toBe('none');
    expect(copy.progressLevel(1, 1, true)).toBe('solved');
  });

  it('reads the winning guess as solved, whatever the field was', () => {
    expect(copy.progressLevel(3000, 1, true)).toBe('solved');
    expect(copy.progressLevel(2, 1, true)).toBe('solved');
  });

  it('only ever improves as a cut deepens', () => {
    const order: Record<copy.ProgressLevel, number> = {
      none: 0,
      slight: 1,
      minor: 2,
      major: 3,
      solved: 4,
    };

    for (const before of [3000, 400, 60, 9, 2]) {
      let previous = 0;
      for (let after = before; after >= 1; after -= 1) {
        const rank = order[level(before, after)];
        expect(rank, `${after} of ${before}`).toBeGreaterThanOrEqual(previous);
        previous = rank;
      }
    }
  });

  it('says nothing in digits, whatever it is handed', () => {
    for (const before of [3000, 253, 60, 9, 2, 1]) {
      for (let after = 1; after <= before; after += 1) {
        for (const won of [true, false]) {
          const phrase = copy.PROGRESS[copy.progressLevel(before, after, won)];
          expect(phrase, `${after} of ${before}`).not.toMatch(/\d/);
        }
      }
    }
  });

  it('decides by whole numbers, so two machines cannot word a round differently', () => {
    // The bands are `after² <= before` and `after⁴ <= before³`, which stay whole
    // numbers well inside exact integer range. The largest either side reaches:
    expect(3000 ** 4).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(3000 ** 3).toBeLessThan(Number.MAX_SAFE_INTEGER);
    // And the boundary itself lands where the integers say, not near it.
    expect(level(2500, 50)).toBe('major');
    expect(level(2499, 50)).toBe('minor');
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
        copy.guessNote(skill, false, 3, 8),
        copy.guessNote(skill, true, 3, 8),
        copy.guessNote(null, false, 1, 3000),
        copy.guessNote(null, false, 6, 1),
      ]),
      [-2, -0.5, 0, 0.5, 2].map((bits) => copy.luckNote(bits)),
      // Every light, including the one that reports the least progress. How far
      // a guess got is partly the feedback's doing, so none of them may read as
      // a verdict on the player.
      Object.values(copy.PROGRESS),
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

  /**
   * A round that ran out of turns, and one that narrows to a single word with
   * two turns still to play — the position the scorer prices at nothing, and the
   * only one where the light is deliberately left unlit.
   */
  const lostScore = scoreDirectly({
    guesses: [PUZZLE.starter, 'crane', 'moist', 'adapt', 'wharf', 'zilch'],
    answer: PUZZLE.answer,
    tookHouseStarter: true,
    hardMode: false,
  });

  it('has an unsolved fixture that reaches a single-word field', () => {
    expect(lostScore.solved).toBe(false);
    expect(lostScore.breakdown.some((row) => row.candidateCount <= 1)).toBe(true);
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

  /** Each row lights for its own guess, which is the point of the column. */
  it('lights each row for the guess on it', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const rows = within(table).getAllByRole('row').slice(1);

    rows.forEach((row, index) => {
      const entry = score.breakdown[index]!;
      const cell = within(row).getAllByRole('cell')[1]!;
      const expected = copy.progressLevel(
        entry.candidateCount,
        entry.remainingCount,
        entry.pattern === WIN_PATTERN,
      );

      expect(cell.textContent, `row ${index + 1}`).toBe(copy.PROGRESS[expected]);
    });
  });

  it('reads the winning guess as solved', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const last = within(table).getAllByRole('row').at(-1)!;

    expect(last).toHaveTextContent(PUZZLE.answer);
    expect(within(last).getAllByRole('cell')[1]).toHaveTextContent(/solved/i);
  });

  /**
   * The column must not count the answer pool. Every row used to carry two exact
   * figures, and the first row's caption was the answer list's exact size on
   * every round ever played — between them an exact count of its words
   * consistent with a guess and a pattern sitting on screen beside them. A digit
   * anywhere in this column is that back, so the assertion is deliberately
   * blunt. Decision 0003 has the argument.
   */
  it('never counts the answer pool, on a round won or lost', () => {
    for (const finished of [score, lostScore]) {
      cleanup();
      render(
        <ThemeProvider theme={theme}>
          <Results score={finished} settings={settings} />
        </ThemeProvider>,
      );

      const table = screen.getByRole('table', { name: /guess by guess/i });
      const rows = within(table).getAllByRole('row').slice(1);

      rows.forEach((row, index) => {
        const cell = within(row).getAllByRole('cell')[1]!;
        expect(cell.textContent, `row ${index + 1} of ${rows.length}`).not.toMatch(/\d/);
      });
    }
  });

  it('lights every row of a lost round, and calls none of them solved', () => {
    render(
      <ThemeProvider theme={theme}>
        <Results score={lostScore} settings={settings} />
      </ThemeProvider>,
    );

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const rows = within(table).getAllByRole('row').slice(1);

    rows.forEach((row, index) => {
      const entry = lostScore.breakdown[index]!;
      const cell = within(row).getAllByRole('cell')[1]!;

      expect(cell).not.toHaveTextContent(/solved/i);
      expect(cell.textContent, `row ${index + 1}`).toBe(
        copy.PROGRESS[copy.progressLevel(entry.candidateCount, entry.remainingCount, false)],
      );
    });
  });

  it('leaves the light unlit where nothing was left to clear', () => {
    // The scorer prices a one-word position at 100 with zero weight, so a red
    // mark there would contradict the row it sits on.
    const unlit = lostScore.breakdown.findIndex((row) => row.candidateCount <= 1);
    expect(unlit, 'fixture must reach a single-word field').toBeGreaterThan(-1);

    render(
      <ThemeProvider theme={theme}>
        <Results score={lostScore} settings={settings} />
      </ThemeProvider>,
    );

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const row = within(table).getAllByRole('row')[unlit + 1]!;
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent(/nothing left to cut/i);
  });

  it('narrows the pool monotonically down the table', () => {
    // Each row's starting pool is the previous row's remainder. If the two ever
    // disagreed, one of the numbers on screen would be describing another turn.
    for (let index = 1; index < score.breakdown.length; index += 1) {
      expect(score.breakdown[index]!.candidateCount).toBe(
        score.breakdown[index - 1]!.remainingCount,
      );
    }
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
