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
import { fieldFill } from '../../src/app/ui/field';
import { Results } from '../../src/app/ui/Results';
import { INSTANT_REVEAL } from '../../src/app/ui/reveal';
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

  it('describes the field in proportions and never in counts', () => {
    // The whole point of the phrasing: a digit here is the size of the answer
    // pool, or a count of the words in it that a pattern left alive.
    for (const before of [3000, 253, 60, 9, 2, 1]) {
      for (let after = 1; after <= before; after += 1) {
        for (const won of [true, false]) {
          const note = copy.fieldNote(before, after, won);
          expect(note, `${after} of ${before}`).not.toMatch(/\d/);
          expect(note.length, `${after} of ${before}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('reads the same phrase for the same cut whatever the field was', () => {
    // Scale-free by construction. If it were not, the phrase would be a
    // roundabout way of reporting the size of the pool.
    expect(copy.fieldNote(3000, 1500, false)).toBe(copy.fieldNote(60, 30, false));
    expect(copy.fieldNote(3000, 300, false)).toBe(copy.fieldNote(200, 20, false));
  });

  it('bands the cut, coarsely and in order', () => {
    const cut = (before: number, after: number) => copy.fieldNote(before, after, false);

    expect(cut(100, 100)).toBe('nothing ruled out');
    expect(cut(100, 120)).toBe('nothing ruled out');
    expect(cut(100, 90)).toBe('narrowed a little');
    expect(cut(100, 50)).toBe('down to half');
    expect(cut(100, 25)).toBe('down to a quarter');
    expect(cut(100, 10)).toBe('down to a tenth');
    expect(cut(3000, 6)).toBe('cut to a fraction');

    // Coarse on purpose: a band that moved with every word would be the count
    // again, spelled out.
    expect(cut(3000, 1400)).toBe(cut(3000, 1100));
  });

  it('names a floor the cut actually reached, never one it did not', () => {
    // The coarseness is only honest if every phrase is true of every cut in its
    // band. Each rung begins where its own fraction is reached, so a sharper cut
    // is understated — and the bar carries what the words round off.
    const named: readonly { readonly phrase: string; readonly divisor: number }[] = [
      { phrase: 'down to half', divisor: 2 },
      { phrase: 'down to a quarter', divisor: 4 },
      { phrase: 'down to a tenth', divisor: 10 },
    ];

    for (const before of [3000, 250, 40]) {
      for (let after = 1; after <= before; after += 1) {
        const claimed = named.find(({ phrase }) => phrase === copy.fieldNote(before, after, false));
        if (claimed !== undefined) {
          expect(after, `${claimed.phrase} claimed for ${after} of ${before}`).toBeLessThanOrEqual(
            before / claimed.divisor,
          );
        }
      }
    }
  });

  it('gives the winning guess no field to puzzle over', () => {
    // One word does remain after a correct guess. Describing it invites the
    // reader to wonder what they are meant to do about it.
    expect(copy.fieldNote(2, 1, true)).toBe('solved');
    expect(copy.fieldNote(3000, 1, true)).toBe('solved');
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
      // Every rung of the field ladder, including the two that report no cut.
      [3000, 1400, 700, 300, 50, 6, 1].flatMap((after) => [
        copy.fieldNote(3000, after, false),
        copy.fieldNote(3000, after, true),
      ]),
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

  const lostScore = scoreDirectly({
    guesses: [PUZZLE.starter, 'crane', 'moist', 'pluck', 'begun', 'dwarf'],
    answer: PUZZLE.answer,
    tookHouseStarter: true,
    hardMode: false,
  });

  it('has an unsolved fixture to test the unsolved cases with', () => {
    expect(lostScore.solved).toBe(false);
  });

  function renderResults() {
    return render(
      <ThemeProvider theme={theme}>
        <Results score={score} settings={settings} />
      </ThemeProvider>,
    );
  }

  /**
   * The drawn length of each row's bar, as a percentage.
   *
   * The width is inline because it is data rather than a design token, so
   * reading it needs no layout engine — which jsdom does not have.
   */
  function barWidths(): number[] {
    const table = screen.getByRole('table', { name: /guess by guess/i });

    return within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number.parseFloat(within(row).getByTestId('field-bar').style.width));
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

  /**
   * The column reports the effect of the guess on its own row, which is what
   * it is for. It used to report that as two exact counts; it now reports it as
   * how far the field fell, which is the same fact about the same guess without
   * the pool's size attached.
   */
  it('reports what each guess did to the field, not what it was handed', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    // The winning guess is the exception, covered on its own below.
    const rows = within(table).getAllByRole('row').slice(1, -1);

    rows.forEach((row, index) => {
      const entry = score.breakdown[index]!;
      const cell = within(row).getAllByRole('cell')[1]!;

      expect(cell.textContent, `row ${index + 1}`).toBe(
        copy.fieldNote(entry.candidateCount, entry.remainingCount, false),
      );
    });
  });

  /**
   * One word does technically remain after a correct guess — the answer. But
   * printing "1" invites the reader to wonder what they are meant to do about
   * it when the game is already over.
   */
  it('gives the winning guess no count to puzzle over', () => {
    renderResults();

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const last = within(table).getAllByRole('row').at(-1)!;
    const cell = within(last).getAllByRole('cell')[1]!;

    expect(last).toHaveTextContent(PUZZLE.answer);
    expect(cell).toHaveTextContent(/solved/i);
    expect(cell.textContent).not.toMatch(/\d/);
  });

  /**
   * The opposite case, and not the same one. A guess that ran the player out of
   * turns still narrowed a field that was standing when the game ended, and
   * that is the story of the round rather than noise at the end of it.
   */
  it('still describes the field on a guess that lost the game', () => {
    render(
      <ThemeProvider theme={theme}>
        <Results score={lostScore} settings={settings} />
      </ThemeProvider>,
    );

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const last = within(table).getAllByRole('row').at(-1)!;
    const cell = within(last).getAllByRole('cell')[1]!;
    const closing = lostScore.breakdown.at(-1)!;

    expect(cell).not.toHaveTextContent(/solved/i);
    expect(cell.textContent).toBe(
      copy.fieldNote(closing.candidateCount, closing.remainingCount, false),
    );
  });

  /**
   * The reason the column stopped printing counts.
   *
   * Every row used to carry two exact figures, and the first row's caption was
   * the answer list's exact size on every round ever played. Between them they
   * gave anybody curious an exact count of answer-list words consistent with a
   * known guess and pattern, which is a membership oracle against a dictionary
   * that ships in the same bundle. Philosophy's rationale for scoring against
   * that list assumes the opposite: it is the self-consistent choice "even
   * though players can't see that pool".
   *
   * A digit anywhere in this column is that leak returning, whatever it is
   * measuring, so the assertion is deliberately blunt.
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

  it('draws every bar at the field its guess left standing', () => {
    for (const finished of [score, lostScore]) {
      cleanup();
      render(
        <ThemeProvider theme={theme}>
          <Results score={finished} settings={settings} />
        </ThemeProvider>,
      );

      const start = finished.breakdown[0]!.candidateCount;
      barWidths().forEach((width, index) => {
        const row = finished.breakdown[index]!;
        expect(width, `row ${index + 1}`).toBeCloseTo(
          fieldFill(row.remainingCount, start) * 100,
          10,
        );
      });
    }
  });

  it('empties the bar once the answer is pinned down', () => {
    renderResults();

    const widths = barWidths();
    // The opener leaves most of the field alive; the winning guess leaves none
    // of it, which is what makes the column readable as a round closing in.
    expect(widths[0]).toBeGreaterThan(0);
    expect(widths.at(-1)).toBe(0);
    for (let index = 1; index < widths.length; index += 1) {
      expect(widths[index]!, `row ${index + 1}`).toBeLessThan(widths[index - 1]!);
    }
  });

  it('says so when a guess ruled nothing out', () => {
    render(
      <ThemeProvider theme={theme}>
        <Results score={lostScore} settings={settings} />
      </ThemeProvider>,
    );

    const stalled = lostScore.breakdown.findIndex(
      (row) => row.remainingCount >= row.candidateCount,
    );
    expect(stalled, 'fixture must contain a guess that ruled nothing out').toBeGreaterThan(-1);

    const table = screen.getByRole('table', { name: /guess by guess/i });
    const row = within(table).getAllByRole('row')[stalled + 1]!;
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent(/nothing ruled out/i);
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
