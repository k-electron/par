/**
 * The explainer's account of a particular round.
 *
 * What is worth testing here is not the wording but the arithmetic: a reader who
 * adds up the numbers this dialog prints must land on the numbers the card
 * prints. So the assertions parse the sums back out of the sentences and check
 * them against what the engine computed, and against each other.
 *
 * The two standing prohibitions get the same treatment as the results view's.
 * The explainer may not count the answer pool and may not name a word nobody
 * played, and both are checked against the round's own figures rather than
 * against a list of phrases somebody remembered to update.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { explainRound, type ExplainedRound } from '../../src/app/copy/explainer';
import { luckNote, NEAR_BEST } from '../../src/app/copy/results';
import { createDirectScoringClient, scoreDirectly } from '../../src/app/scoring/direct';
import { Repository } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { theme } from '../../src/app/theme/theme';
import { App } from '../../src/app/ui/App';
import { INSTANT_REVEAL } from '../../src/app/ui/reveal';
import { ScoringExplainer } from '../../src/app/ui/ScoringExplainer';
import { answers, starters } from '../../src/data';
import { C_PAR, UNSOLVED_GUESSES } from '../../src/engine/config/constants';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { outcomePoints, type GameScore } from '../../src/engine/score/scoreGame';

const PUZZLE_NUMBER = 165;
const PUZZLE = drawPuzzle(PUZZLE_NUMBER, { answers, starters });
const FIXED_NOW = new Date('2026-06-15T16:00:00Z');

const MINUS = '\u2212';

function round(guesses: string[], tookHouseStarter = true): GameScore {
  return scoreDirectly({
    guesses,
    answer: PUZZLE.answer,
    tookHouseStarter,
    hardMode: false,
  });
}

/**
 * Four rounds that between them reach every branch worth reaching: an ordinary
 * solve, a round that ran out of turns and spent two guesses on a field of one,
 * a one-guess win where nothing is skill-scored at all, and a round that
 * declined the starter bonus.
 */
const ROUNDS = {
  solved: round([PUZZLE.starter, 'crane', PUZZLE.answer]),
  lost: round([PUZZLE.starter, 'crane', 'moist', 'adapt', 'wharf', 'zilch']),
  holeInOne: round([PUZZLE.answer]),
  ownOpener: round(['crane', PUZZLE.answer], false),
} as const;

const CASES = Object.entries(ROUNDS).map(([name, score]) => ({ name, score }));

/** Every sentence the explainer would put on screen for a round. */
function phrases(explained: ExplainedRound): string[] {
  return [
    explained.lead,
    ...explained.guesses.flatMap((guess) => [guess.skillStory, guess.luckStory]),
    explained.skill.figure,
    explained.skill.story,
    explained.skill.result,
    ...explained.skill.shares.flatMap((share) => [share.score, share.share]),
    explained.par.figure,
    explained.par.story,
    explained.bonus.figure,
    explained.bonus.story,
    explained.total.figure,
    explained.total.story,
  ];
}

/**
 * How the two directions of the luck sentence read.
 *
 * Both can say "as many words", since half as many and twice as many are both
 * multiples, so the direction has to be read off the quantifier rather than off
 * the shape of the phrase.
 */
const CROWDED =
  /more words in play|(twice|three times|four times|five times|several times) as many|the likeliest way/;
const CLEARED = /fewer words in play|(half|a third|a quarter|a fifth) as many|a small fraction/;

/** The first number in a fragment, however it is dressed: `64% of the average`. */
function value(text: string): number {
  const [first] = text.replace(MINUS, '-').match(/-?\d+(?:\.\d+)?/) ?? [];
  return first === undefined ? Number.NaN : Number(first);
}

/** `86.43 + 2.84 + 3.00` as a number, the way a reader adds it up. */
function addUp(expression: string): number {
  const tokens = expression.trim().split(/\s+/);
  let total = value(tokens[0]!);

  for (let index = 1; index < tokens.length; index += 2) {
    const sign = tokens[index] === '+' ? 1 : -1;
    total += sign * value(tokens[index + 1]!);
  }

  return total;
}

/** The `a + b = c` at the end of a sentence, split into its two sides. */
function equation(sentence: string): { left: string; right: number } {
  const arithmetic = sentence.slice(sentence.lastIndexOf(':') + 1).replace(/\.\s*$/, '');
  const [left, right] = arithmetic.split('=');

  expect(right, sentence).toBeDefined();
  return { left: left!, right: value(right!.trim()) };
}

afterEach(cleanup);

describe('the arithmetic the explainer shows', () => {
  it.each(CASES)('$name: the parts it prints add up to the total it prints', ({ score }) => {
    const { left, right } = equation(explainRound(score).total.story);

    // Both halves matter. The left one is what a reader adds up; the right one
    // is what the card says, and an explanation that agrees with itself while
    // disagreeing with the card would be worse than none.
    expect(addUp(left)).toBeCloseTo(right, 2);
    expect(right).toBeCloseTo(score.total, 1);
  });

  it.each(CASES)('$name: prices par the way the engine priced it', ({ score }) => {
    const { left, right } = equation(explainRound(score).par.story);
    const charged = score.solved ? score.guessesUsed : UNSOLVED_GUESSES;

    // The engine's own conversion, reached through the one function spec §3
    // allows it to happen in.
    expect(right).toBeCloseTo(outcomePoints(score.guessesUsed, score.solved), 2);
    expect(left).toContain(String(C_PAR));
    expect(left).toContain(String(charged));
    // And the multiplication as printed has to come out at the answer printed,
    // which is what keeps a shortened par out of the sentence.
    expect(addUp(left.slice(left.indexOf('(') + 1).replace(')', ''))).toBeCloseTo(
      right / C_PAR,
      4,
    );
  });

  it.each(CASES)('$name: names the same skill figure the engine computed', ({ score }) => {
    expect(value(explainRound(score).skill.figure)).toBeCloseTo(score.skill, 1);
  });

  it('weights the guesses so its own shares reproduce the skill figure', () => {
    for (const { name, score } of CASES) {
      const explained = explainRound(score);
      const shares = explained.skill.shares;
      if (shares.length === 0) continue;

      const counted = shares.filter((share) => /\d/.test(share.share));
      const total = counted.reduce((sum, share) => sum + value(share.share), 0);
      const weighted = counted.reduce(
        (sum, share) => sum + (value(share.share) / 100) * value(share.score),
        0,
      );

      // Whole percentages, apportioned so the column sums to a hundred rather
      // than to 99 or 101.
      expect(total, name).toBe(100);
      // Multiplying the column out has to land on the figure above it. A wrong
      // weighting basis — words rather than bits, say — would drift here even
      // though every individual number looked plausible.
      expect(weighted, name).toBeCloseTo(score.skill, 0);
    }
  });

  it('leaves a guess that faced one word out of the weighting, not out of the account', () => {
    // Two of this round's guesses scored 50 against a single-word field. Both
    // have to appear — a reader looking for them is asking why the skill figure
    // is 85 rather than 50-something — and neither may pull the average down.
    const explained = explainRound(ROUNDS.lost);
    const uncounted = explained.skill.shares.filter((share) => !/\d/.test(share.share));
    const poor = 60;

    expect(uncounted).toHaveLength(2);
    for (const share of uncounted) {
      expect(share.share).toMatch(/none of the average/);
      expect(value(share.score)).toBeLessThan(poor);
    }
    expect(value(explained.skill.figure)).toBeGreaterThan(poor);
  });

  it('explains an unsolved round as the guesses it is priced at', () => {
    const explained = explainRound(ROUNDS.lost);

    expect(explained.par.story).toContain(String(UNSOLVED_GUESSES));
    expect(explained.par.story).toMatch(/did not solve/i);
    expect(value(explained.par.figure)).toBeCloseTo(outcomePoints(6, false), 2);
  });

  it('explains a skill figure that had nothing to average', () => {
    // A one-guess win skill-scores nothing at all, and 100% is then a default
    // rather than something earned. Saying so is the difference between an
    // honest figure and a boast.
    const explained = explainRound(ROUNDS.holeInOne);

    expect(explained.skill.shares).toEqual([]);
    expect(explained.skill.story).toMatch(/had none/i);
    expect(explained.skill.result).toMatch(/default/i);
  });

  it('adds no bonus term for a round that did not take the starter', () => {
    const own = explainRound(ROUNDS.ownOpener);
    const house = explainRound(ROUNDS.solved);

    expect(own.bonus.figure).toBe('None');
    expect(own.bonus.story).toMatch(/own opener/i);
    // Two terms rather than three, and still summing to the card's total, which
    // the case above checks.
    expect(equation(own.total.story).left.trim().split(/\s+/)).toHaveLength(3);
    expect(equation(house.total.story).left.trim().split(/\s+/)).toHaveLength(5);
  });
});

describe('the guess by guess account', () => {
  it.each(CASES)('$name: covers every guess played, in order', ({ score }) => {
    expect(explainRound(score).guesses.map((guess) => guess.guess)).toEqual(
      score.breakdown.map((row) => row.guess),
    );
  });

  it.each(CASES)('$name: reads the opener as unscored and points at par', ({ score }) => {
    const opener = explainRound(score).guesses[0]!;

    expect(opener.skillStory).toMatch(/not scored/i);
    expect(opener.skillStory).toMatch(/par/i);
  });

  it.each(CASES)('$name: agrees with the results table about how the tiles broke', ({ score }) => {
    const explained = explainRound(score);

    score.breakdown.forEach((row, index) => {
      const story = explained.guesses[index]!.luckStory;
      const note = luckNote(row.luck);
      const deadField = row.skill !== null && row.weight === 0;
      const won = score.solved && index === score.breakdown.length - 1;

      if (deadField) {
        expect(story, row.guess).toMatch(/nothing for the tiles to decide/);
      } else if (won) {
        expect(story, row.guess).toMatch(/came home/);
      } else if (note === 'broke as expected') {
        expect(story, row.guess).toMatch(/about as they usually do/);
      } else if (row.luck > 0) {
        expect(story, row.guess).toMatch(CLEARED);
      } else {
        expect(story, row.guess).toMatch(CROWDED);
      }
    });
  });

  it('never describes a kind break as a crowded one, or the reverse', () => {
    // The two directions are different arithmetic — a field twice as big is
    // 100% more, but one twice as small is 50% fewer, not 100% fewer — so the
    // easy bug here is a sentence that contradicts the sign printed beside it.
    // Swept across a spread of luck figures rather than the handful the four
    // rounds happen to contain.
    const row = {
      turn: 2,
      guess: 'crane',
      skill: 80,
      weight: 4,
      forced: false,
      wasCandidate: false,
      // Below the likeliest share, so the size clause is the one under test
      // rather than the "came back the likeliest way" branch.
      outcomeShare: 0.05,
      likeliestOutcomeShare: 0.5,
    };

    for (let luck = -4; luck <= 4; luck += 0.1) {
      const story = explainRound({
        ...ROUNDS.solved,
        solved: false,
        breakdown: [{ ...row, luck }],
      }).guesses[0]!.luckStory;

      if (luck > 0.5) {
        expect(story, `luck ${luck}`).toMatch(CLEARED);
        expect(story, `luck ${luck}`).not.toMatch(CROWDED);
      } else if (luck < -0.5) {
        expect(story, `luck ${luck}`).toMatch(CROWDED);
        expect(story, `luck ${luck}`).not.toMatch(CLEARED);
      }
    }
  });

  it('states each guess\u2019s own skill figure', () => {
    const score = ROUNDS.lost;
    const explained = explainRound(score);

    score.breakdown.forEach((row, index) => {
      const story = explained.guesses[index]!.skillStory;
      if (row.skill === null) return;
      expect(story, row.guess).toContain(`${row.skill.toFixed(1)}%`);
    });
  });

  it.each(CASES)('$name: says which guesses could have won and which could not', ({ score }) => {
    // The one lesson the general account spends a section on — that a word
    // which cannot win can be the best play — only lands if the reader can see
    // which of their own guesses were which.
    const explained = explainRound(score);

    score.breakdown.forEach((row, index) => {
      const story = explained.guesses[index]!.skillStory;
      // Openers, forced moves and dead fields are explained by what the
      // position was, which says more than what the guess could have been.
      if (row.skill === null || row.forced || row.weight === 0) return;

      if (row.wasCandidate) {
        expect(story, row.guess).toMatch(/could have won outright/);
      } else {
        expect(story, row.guess).toMatch(/could not have been the answer/);
      }
    });
  });

  it('prices the gap only where the table has already called it short of best', () => {
    // `NEAR_BEST` is shared with `guessNote` on purpose. A row badged "Near
    // best" in the table and then told in the dialog how many more turns it was
    // heading for is two surfaces disagreeing about one number.
    for (const { name, score } of CASES) {
      const explained = explainRound(score);

      score.breakdown.forEach((row, index) => {
        const story = explained.guesses[index]!.skillStory;
        if (row.skill === null || row.forced || row.weight === 0) return;

        if (row.skill >= NEAR_BEST) {
          expect(story, `${name} ${row.guess}`).not.toMatch(/more turns|as many turns/);
        } else {
          expect(story, `${name} ${row.guess}`).toMatch(/more turns|as many turns/);
        }
      });
    }
  });

  it('leaves the row it declines to count out of the pricing altogether', () => {
    // A guess facing one word weighs nothing in the average, and telling it how
    // many more turns it was heading for would be the loudest sentence on the
    // card attached to the row the score itself ignores.
    const explained = explainRound(ROUNDS.lost);
    const dead = ROUNDS.lost.breakdown
      .map((row, index) => ({ row, story: explained.guesses[index]!.skillStory }))
      .filter(({ row }) => row.skill !== null && row.weight === 0);

    expect(dead.length).toBeGreaterThan(0);
    for (const { story } of dead) {
      expect(story).not.toMatch(/more turns|as many turns/);
      expect(story).toMatch(/one word was still possible/);
    }
  });

  it('does not read a win on a dead field as a stroke of luck', () => {
    // Walking in the last possible word wins on a field of one, where the luck
    // figure is exactly zero. The winning row's usual line explains a large
    // number, so on this round it would be captioning a 0.0.
    const walkIn = round([PUZZLE.starter, 'crane', 'moist', 'adapt', PUZZLE.answer]);
    const last = walkIn.breakdown.at(-1)!;
    const story = explainRound(walkIn).guesses.at(-1)!.luckStory;

    expect(walkIn.solved).toBe(true);
    expect(last.weight).toBe(0);
    expect(Math.abs(last.luck)).toBeLessThan(0.05);
    expect(story).toMatch(/nothing for the tiles to decide/);
    expect(story).not.toMatch(/came home/);
  });
});

describe('what the explainer must not give away', () => {
  it.each(CASES)('$name: explains the round without being told any count', ({ score }) => {
    // Decision 0003: how many words are possible is ours, not the player's. The
    // guarantee here is structural rather than a scan for digits — strip the two
    // counts out of the score and the explanation is identical, so no sentence
    // in it can be a function of a count.
    //
    // The three fields decision 0005 added survive the stripping, and that is
    // the point of listing them one by one rather than spreading the row: two
    // of them are ratios of the counts and one is a boolean, so none of them
    // can be inverted into a count, and adding a fourth field has to be a
    // decision taken here rather than something a spread would wave through.
    const blind = {
      ...score,
      breakdown: score.breakdown.map(
        ({
          turn,
          guess,
          skill,
          weight,
          luck,
          forced,
          wasCandidate,
          outcomeShare,
          likeliestOutcomeShare,
        }) => ({
          turn,
          guess,
          skill,
          weight,
          luck,
          forced,
          wasCandidate,
          outcomeShare,
          likeliestOutcomeShare,
        }),
      ),
    };

    expect(explainRound(blind)).toEqual(explainRound(score));
  });

  it.each(CASES)('$name: shows a weight only as a share of the round\u2019s total', ({ score }) => {
    // `weight` is log2 of a count, so printing one raw would leak the count by
    // another route. Doubling every weight leaves the shares untouched — exactly,
    // since a share is a ratio and scaling by two is exact in binary — so any
    // text that moved would have been a weight on its own.
    const doubled = {
      ...score,
      breakdown: score.breakdown.map((row) => ({ ...row, weight: row.weight * 2 })),
    };

    expect(explainRound(doubled)).toEqual(explainRound(score));
  });

  it.each(CASES)('$name: prints no figure large enough to be a count', ({ score }) => {
    // Everything the explainer legitimately prints is a percentage of at most a
    // hundred or a points figure with decimals. A bare integer above a hundred
    // could only be a count of words, and the opening position's count is the
    // size of the answer list itself.
    const text = phrases(explainRound(score)).join(' | ');
    const counts = new Set(
      score.breakdown.flatMap((row) => [row.candidateCount, row.remainingCount]),
    );

    expect([...counts].some((count) => count > 100)).toBe(true);
    for (const count of counts) {
      if (count <= 100) continue;
      expect(text, `count ${count}`).not.toMatch(
        new RegExp(String.raw`(?<![\d.])${count}(?![\d.])`),
      );
    }
  });

  it.each(CASES)('$name: names no word but the ones played', ({ score }) => {
    // Words are the one thing printed in capitals, so a scan for capitals is
    // exact where a scan for five-letter strings would trip over "share".
    const named = phrases(explainRound(score)).flatMap((phrase) => [
      ...phrase.matchAll(/\b[A-Z]{2,}\b/g),
    ]);
    const played = new Set(score.breakdown.map((row) => row.guess.toUpperCase()));

    expect(named.length).toBeGreaterThan(0);
    expect(named.map((match) => match[0]).filter((word) => !played.has(word))).toEqual([]);
  });

  it.each(CASES)('$name: never scolds, and never points at a play nobody made', ({ score }) => {
    for (const phrase of phrases(explainRound(score))) {
      expect(phrase, phrase).not.toMatch(
        /should have|shouldn't|mistake|wrong move|blunder|wasted|bad guess|poorly|too bad/i,
      );
      expect(phrase, phrase).not.toMatch(/optimal|best word|correct word|better word|instead of/i);
    }
  });
});

describe('the dialog', () => {
  function mountDialog(score: GameScore | null) {
    return render(
      <ThemeProvider theme={theme}>
        <ScoringExplainer open score={score} onClose={() => {}} />
      </ThemeProvider>,
    );
  }

  it('walks through the round it was handed', () => {
    mountDialog(ROUNDS.solved);
    const section = screen.getByTestId('explainer-round');

    for (const row of ROUNDS.solved.breakdown) {
      expect(section).toHaveTextContent(row.guess.toUpperCase());
    }
    expect(section).toHaveTextContent(equation(explainRound(ROUNDS.solved).total.story).left.trim());
  });

  it('still explains the game with no round to explain', () => {
    // A replay still scoring, or one this build declined to score, opens the
    // same dialog. It must read as an explanation rather than as a gap.
    mountDialog(null);

    expect(screen.queryByTestId('explainer-round')).not.toBeInTheDocument();
    expect(screen.getByText(/cannot possibly be the answer/i)).toBeInTheDocument();
    expect(screen.getByText(/never show you the word you should have played/i)).toBeInTheDocument();
  });

  it('never publishes the size of the answer list', () => {
    // The opening position faces every answer there is, so this one count would
    // otherwise be on screen for every round anybody ever played.
    const size = ROUNDS.lost.breakdown[0]!.candidateCount;
    mountDialog(ROUNDS.lost);

    expect(screen.getByTestId('explainer-round').textContent).not.toMatch(
      new RegExp(String.raw`(?<![\d.])${size}(?![\d.])`),
    );
  });
});

describe('reaching it from a finished game', () => {
  it('explains the round the player just played', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <App
          repository={new Repository(createMemoryStorage())}
          now={FIXED_NOW}
          scoring={createDirectScoringClient()}
          reveal={INSTANT_REVEAL}
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('crane{Enter}');
    await user.keyboard(`${PUZZLE.answer}{Enter}`);

    await user.click(await screen.findByRole('button', { name: /how is this scored/i }));

    const played = round([PUZZLE.starter, 'crane', PUZZLE.answer]);
    const section = await screen.findByTestId('explainer-round');

    // The guesses this player actually made, and the sum that produced the
    // total on their card.
    for (const row of played.breakdown) {
      expect(section).toHaveTextContent(row.guess.toUpperCase());
    }
    expect(section).toHaveTextContent(equation(explainRound(played).total.story).left.trim());
  });

  /**
   * A link minted at `e4e1210`, byte for byte, long before this dialog said
   * anything about a particular round. It carries the puzzle, the flags, the
   * guess indices and two version stamps — never a figure — so the walkthrough
   * is rebuilt from the score recomputed on this machine. Frozen as a literal
   * rather than re-encoded: re-encoding would only prove the codec agrees with
   * itself, where a literal proves a link already in somebody's chat history
   * opens and now explains itself.
   *
   * Puzzle 165, house starter, ICONS CRANE MOIST SHAPE.
   */
  const LINK_FROM_BEFORE = 'fc6668dzIV7rfcBRhLcYLhRQ';
  const PLAYED_THEN = ['icons', 'crane', 'moist', 'shape'];

  it('explains a round shared before it could explain anything', async () => {
    const user = userEvent.setup();
    const store = new Repository(createMemoryStorage());
    // Past the spoiler gate: this reader has finished that day themselves.
    store.saveDay({
      puzzleNumber: PUZZLE_NUMBER,
      settings: { hardMode: false, useHouseStarter: true, confirmed: true },
      guesses: PLAYED_THEN,
      status: 'won',
      completedAt: Date.now(),
    });

    render(
      <ThemeProvider theme={theme}>
        <App
          repository={store}
          now={FIXED_NOW}
          scoring={createDirectScoringClient()}
          initialHash={`#r=${LINK_FROM_BEFORE}`}
        />
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /how is this scored/i }));
    const section = await screen.findByTestId('explainer-round');
    const sender = round(PLAYED_THEN);

    for (const word of PLAYED_THEN) {
      expect(section).toHaveTextContent(word.toUpperCase());
    }
    // The same total the card recomputed for the sender, reached by the sum the
    // explainer prints rather than by asserting a string.
    const { left, right } = equation(explainRound(sender).total.story);
    expect(addUp(left)).toBeCloseTo(sender.total, 1);
    expect(section).toHaveTextContent(`${right.toFixed(2)}`);
  });
});
