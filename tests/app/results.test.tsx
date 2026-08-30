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
import type { GameScore, GuessBreakdown } from '../../src/engine/score/scoreGame';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

const settings: ConfirmedSettings = { hardMode: false, useHouseStarter: true, confirmed: true };

/**
 * One breakdown row, from the two counts the progress column reads.
 *
 * Everything else is filler the column never looks at, so it is set to whatever
 * keeps the row valid rather than to anything meaningful.
 */
function handRow(
  turn: number,
  guess: string,
  candidateCount: number,
  remainingCount: number,
  pattern = 0,
): GuessBreakdown {
  return {
    turn,
    guess,
    pattern,
    candidateCount,
    remainingCount,
    skill: turn === 1 ? null : 80,
    weight: 1,
    luck: 0,
    forced: false,
    standing: 0.5,
    outcomeShare: remainingCount / candidateCount,
    likeliestOutcomeShare: remainingCount / candidateCount,
  };
}

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
    // Such a row weighs log2 1 = 0 in the skill average, so it cannot move the
    // score either way. A red mark would be the only judgement on it.
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

/**
 * The bar's scale, apart from the view, because the interesting part is the map
 * rather than the markup.
 */
describe('the skill meter', () => {
  it('spends the whole track on the range a guess can reach', () => {
    // 50 is a whole turn given up — one word left and a guess that was not it —
    // and nothing scored below it in about a thousand simulated rows.
    expect(copy.skillMeterFill(100)).toBe(100);
    expect(copy.skillMeterFill(75)).toBe(50);
    expect(copy.skillMeterFill(50)).toBe(0);
  });

  it('separates two scores the old track drew almost on top of each other', () => {
    // A real pair from puzzle 242: 97.8 beside a 100. On a 0-100 track they
    // differed by 2.2% of the width, which is under a pixel at this size.
    expect(copy.skillMeterFill(100) - copy.skillMeterFill(97.8)).toBeCloseTo(4.4, 6);
  });

  it('empties rather than inverts under the floor', () => {
    // The floor is measured, not proved. A row below it must not draw backwards.
    expect(copy.skillMeterFill(40)).toBe(0);
    expect(copy.skillMeterFill(0)).toBe(0);
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
   * two turns still to play — the position that weighs nothing in the skill
   * average, and the only one where the light is deliberately left unlit.
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

  /**
   * A round assembled by hand rather than played, for the tests about what the
   * progress column draws.
   *
   * Deriving the expected band from `progressLevel` in the assertion is the
   * temptation, and it proves nothing: it recomputes the component's own
   * expression, so it passes whatever the bands turn out to be, and it makes
   * what the test claims a function of the generated word lists. These counts
   * are chosen so each row lands in a different band, written out below. Where
   * the bands themselves belong is `describe('the progress light')` above.
   */
  const banded: GameScore = {
    skill: 80,
    outcome: 0,
    starterBonus: 0,
    total: 80,
    guessesUsed: 5,
    solved: true,
    breakdown: [
      // 100 words off 3000 is barely a step into the uncertainty.
      handRow(1, 'spork', 3000, 2900),
      // after² <= before: half of what was left to find out.
      handRow(2, 'crane', 2900, 40),
      // after⁴ <= before³ but not the above: a quarter.
      handRow(3, 'moist', 40, 11),
      // Nothing left to remove, two turns from the end.
      handRow(4, 'pluck', 1, 1),
      handRow(5, 'yeast', 1, 1, WIN_PATTERN),
    ],
  };

  /** The same rows, with the last one failing instead of winning. */
  const bandedLost: GameScore = {
    ...banded,
    solved: false,
    breakdown: banded.breakdown.map((row, index) =>
      index === banded.breakdown.length - 1 ? { ...row, pattern: 0 } : row,
    ),
  };

  const BANDS = ['little or nothing', 'a big cut', 'a fair cut', 'nothing left to cut', 'solved'];

  function renderBanded(score: GameScore) {
    render(
      <ThemeProvider theme={theme}>
        <Results score={score} settings={settings} />
      </ThemeProvider>,
    );
    return within(screen.getByRole('table', { name: /guess by guess/i }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]!.textContent);
  }

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

  it('draws each row the band its own guess earned', () => {
    // Five rows, five different bands, in this order. A column that read the
    // wrong row's counts would come out in a different order; one that read the
    // same row every time would not vary at all.
    expect(renderBanded(banded)).toEqual(BANDS);
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

  it('bands every row of a lost round, and calls none of them solved', () => {
    const drawn = renderBanded(bandedLost);

    // Only the winning pattern earns the top band, so the last row drops to the
    // one its counts alone deserve rather than keeping the round's ending.
    expect(drawn).toEqual([...BANDS.slice(0, -1), 'nothing left to cut']);
    expect(drawn.join(' ')).not.toMatch(/solved/i);
  });

  it('leaves the light unlit where nothing was left to clear', () => {
    // A one-word position weighs nothing in the skill average, so a red mark
    // there would be the only judgement on a row the score does not count.
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
      .map((row) => within(row).getAllByRole('cell')[0]!.textContent ?? '');

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
