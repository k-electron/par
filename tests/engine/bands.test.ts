/**
 * The search bands, measured on the real word lists.
 *
 * `tests/engine/exactness.test.ts` compares the validated ladder against full
 * brute force, which is only tractable on a small fixture lexicon — and on a
 * fourteen-word lexicon every position falls in the bottom band. So that suite,
 * for all its rigour, never exercises the three bands the shipped lists actually
 * use: `|S_2|` on a real day is in the hundreds.
 *
 * This file closes that hole. Spec §3 asks for scores "exact where precision is
 * visible — small candidate sets, endgames — and near-exact elsewhere", which is
 * two different promises, so they are asserted separately:
 *
 * - at fifteen candidates or fewer, the cheap ladder must agree with a far wider
 *   one **exactly**
 * - above that it must agree closely, and the tolerance is stated rather than
 *   assumed
 *
 * Without this, the mid bands could drift arbitrarily far and nothing would say
 * so.
 */

import { describe, expect, it } from 'vitest';

import { answers, guesses } from '../../src/data';
import { MAX_GUESSES } from '../../src/engine/config/constants';
import { normalRuleset } from '../../src/engine/rules/ruleset';
import { scoreGame } from '../../src/engine/score/scoreGame';
import { createPositionScorer } from '../../src/engine/score/scoreGuess';
import { validatedPolicy } from '../../src/engine/search/policy';
import type { SearchPolicy } from '../../src/engine/search/policy';
import { compileLexicon } from '../../src/engine/words/lexicon';
import { computePattern, WIN_PATTERN } from '../../src/engine/words/pattern';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { starters } from '../../src/data';

const lexicon = compileLexicon({ guesses, answers });
const lists = { answers: [...answers], starters: [...starters] };

/**
 * A meaningfully wider ladder, and the reason it is defined here rather than
 * imported.
 *
 * `widerPolicy` is exhaustive below fifteen candidates — every one of the 12,972
 * guesses, each with a full recursion. That is tractable on the fourteen-word
 * fixture `exactness.test.ts` uses and hopelessly slow on the real dictionary,
 * which is why that suite cannot reach these bands in the first place.
 *
 * Roughly four times the validated budget is enough to show the cheap ladder is
 * not leaving value on the table, while still finishing in seconds.
 */
const widerPolicy: SearchPolicy = {
  name: 'wider',
  budgetFor: (candidateCount) => {
    if (candidateCount > 200) return { probes: 8, candidates: 4 };
    if (candidateCount > 60) return { probes: 12, candidates: 8 };
    if (candidateCount > 15) return { probes: 24, candidates: 16 };
    return { probes: 48, candidates: 48 };
  },
};

/**
 * How far the cheap ladder may sit from the wider one above fifteen candidates.
 *
 * Under a point of skill when this was written. The ceiling has headroom so
 * ordinary variation does not fail the build, but it is tight enough that a real
 * regression would.
 */
const TOLERANCE_ABOVE_15 = 1.5;

interface Sample {
  readonly label: string;
  readonly candidateCount: number;
  readonly skill: number;
}

/**
 * Score a plausible game for one day, sampling every position it passes through.
 *
 * The guesses are fixed rather than chosen by the search, so both policies see
 * exactly the same positions — the point is to compare their valuations, not
 * their play.
 */
function sampleDay(day: number, policy: SearchPolicy, probes: readonly string[]): Sample[] {
  const puzzle = drawPuzzle(day, lists);
  const scorer = createPositionScorer({ lexicon, ruleset: normalRuleset, policy });

  const history: { guess: string; pattern: number }[] = [];
  const samples: Sample[] = [];

  const played = [puzzle.starter, ...probes].slice(0, MAX_GUESSES);
  for (const [turn, guess] of played.entries()) {
    const candidateCount = scorer.candidatesAfter(history).length;
    if (candidateCount === 0) break;

    if (turn >= 1) {
      samples.push({
        label: `day ${day} turn ${turn + 1} |S|=${candidateCount} ${guess}`,
        candidateCount,
        skill: scorer.scoreGuess(history, guess).skill,
      });
    }

    const pattern = computePattern(guess, puzzle.answer);
    if (pattern === WIN_PATTERN) break;
    history.push({ guess, pattern });
  }

  return samples;
}

// Real words, deliberately ordinary rather than optimal, so the positions they
// create look like the ones a player actually reaches.
const PROBES = ['crane', 'moist', 'pluck', 'begun', 'dwarf'];

/**
 * Days chosen so that all four bands are actually reached.
 *
 * Not arbitrary: with these probes, day 1 and day 100 open above 200 candidates,
 * days 6 and 21 land in the 61-to-200 band, day 7 in the 16-to-60 band, and
 * every day passes through the bottom band as it closes out. Picking days
 * without checking left band 2 with no samples at all and the suite quietly
 * asserting less than it appeared to.
 */
const DAYS = [0, 1, 6, 7, 21, 100, 165];

function compare(days: readonly number[]) {
  const cheap = days.flatMap((day) => sampleDay(day, validatedPolicy, PROBES));
  const wide = days.flatMap((day) => sampleDay(day, widerPolicy, PROBES));
  expect(wide).toHaveLength(cheap.length);
  return cheap.map((sample, index) => ({ cheap: sample, wide: wide[index]! }));
}

describe('the validated ladder against a wider one, on the real lists', () => {
  const pairs = compare(DAYS);

  it('samples the bands the shipped lists actually use', () => {
    // Guards the test itself: if every sample landed in the bottom band this
    // file would be asserting nothing that exactness.test.ts does not.
    const counts = pairs.map(({ cheap }) => cheap.candidateCount);
    expect(Math.max(...counts)).toBeGreaterThan(200);
    expect(counts.filter((count) => count > 60 && count <= 200).length).toBeGreaterThan(0);
    expect(counts.filter((count) => count <= 15).length).toBeGreaterThan(0);
  });

  it('is exact at fifteen candidates or fewer', () => {
    // Spec §3's "exact where precision is visible". This is also the band the
    // §10 checks live in, so anything less than equality here would undermine
    // them.
    const small = pairs.filter(({ cheap }) => cheap.candidateCount <= 15);
    expect(small.length).toBeGreaterThan(0);

    for (const { cheap, wide } of small) {
      expect(cheap.skill, cheap.label).toBe(wide.skill);
    }
  });

  it('stays within a stated tolerance above fifteen candidates', () => {
    const large = pairs.filter(({ cheap }) => cheap.candidateCount > 15);
    expect(large.length).toBeGreaterThan(0);

    const worst = large.reduce(
      (max, { cheap, wide }) => Math.max(max, Math.abs(cheap.skill - wide.skill)),
      0,
    );

    expect(worst, `worst disagreement above 15 candidates was ${worst.toFixed(3)}`).toBeLessThan(
      TOLERANCE_ABOVE_15,
    );
  });

  it('never scores a player above the wider search by more than the tolerance', () => {
    // The direction matters. A cheap ladder overestimates its own benchmark, so
    // it flatters the player rather than penalising them — being generous when
    // uncertain is the right way round, but it must stay small.
    for (const { cheap, wide } of pairs) {
      expect(cheap.skill, cheap.label).toBeLessThan(wide.skill + TOLERANCE_ABOVE_15);
    }
  });
});

describe('a scorer reused across games', () => {
  /**
   * The ranking key is summed in the order patterns are first encountered, not
   * in ascending pattern order — a deliberate optimisation, and safe only
   * because a node's candidates are always ascending answer indices and matrix
   * columns are assigned in the same order. Reusing one scorer across games is
   * the way that invariant could quietly break: a matrix built for one game's
   * candidates, then reused for another, could present columns in a different
   * order and silently reorder the sum.
   *
   * The shipped code builds a fresh scorer per request, so this holds today. It
   * is tested because nothing structural stops a future caller from sharing one.
   */
  function scoreVia(scorer: ReturnType<typeof createPositionScorer>, day: number) {
    const puzzle = drawPuzzle(day, lists);
    return scoreGame(
      { guesses: [puzzle.starter, ...PROBES], answer: puzzle.answer, tookHouseStarter: true },
      scorer,
    );
  }

  function freshScorer() {
    return createPositionScorer({ lexicon, ruleset: normalRuleset, policy: validatedPolicy });
  }

  it('gives the same numbers as a scorer that saw nothing else', () => {
    const clean = scoreVia(freshScorer(), 165);

    // Warm the same scorer on a larger, different game first.
    const shared = freshScorer();
    scoreVia(shared, 1);
    const afterOtherGame = scoreVia(shared, 165);

    expect(afterOtherGame.total).toBe(clean.total);
    expect(afterOtherGame.breakdown.map((row) => row.skill)).toEqual(
      clean.breakdown.map((row) => row.skill),
    );
  });

  it('does not depend on the order the games were scored in', () => {
    const forwards = freshScorer();
    const first = scoreVia(forwards, 7);
    const second = scoreVia(forwards, 100);

    const backwards = freshScorer();
    const secondFirst = scoreVia(backwards, 100);
    const firstSecond = scoreVia(backwards, 7);

    expect(firstSecond.total).toBe(first.total);
    expect(secondFirst.total).toBe(second.total);
  });
});

describe('the scoring budget', () => {
  /**
   * Timed through `scoreGame`, which is the only path the app uses.
   *
   * This distinction is the whole performance story and it is easy to get
   * wrong — measuring `scoreGuess` on the opener instead takes about fifteen
   * seconds, because `|S_1|` is the entire 3,000-word answer list. `scoreGame`
   * never asks that question. Spec §3 puts it plainly: because guess 1 is never
   * scored, every position ever scored has already been filtered to a few
   * hundred candidates. Score the opener and you are measuring a position the
   * product does not have.
   */
  function timeGame(day: number): { elapsed: number; solved: number } {
    const puzzle = drawPuzzle(day, lists);
    const scorer = createPositionScorer({
      lexicon,
      ruleset: normalRuleset,
      policy: validatedPolicy,
    });

    const started = performance.now();
    scoreGame(
      { guesses: [puzzle.starter, ...PROBES], answer: puzzle.answer, tookHouseStarter: true },
      scorer,
    );
    return { elapsed: performance.now() - started, solved: scorer.solved };
  }

  it('scores a full six-guess game inside two seconds', () => {
    // Spec §9 budgets under two seconds on a mid-range phone. A CI runner is not
    // a phone, so treat this as guarding an order of magnitude — which is what
    // widening a band would cost — rather than guarding jitter.
    const { elapsed } = timeGame(165);
    expect(elapsed, `scoring took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
  });

  it('stays inside the budget on the worst of several real days', () => {
    const worst = Math.max(...[0, 1, 7, 100, 165].map((day) => timeGame(day).elapsed));
    expect(worst, `worst day took ${worst.toFixed(0)} ms`).toBeLessThan(2000);
  });

  it('visits a bounded number of positions, which is the deterministic part', () => {
    // Wall-clock varies with the machine; the number of positions the search
    // solves does not. This is the guard that would actually catch a band being
    // widened by accident, on any hardware.
    const { solved } = timeGame(165);
    expect(solved).toBeGreaterThan(0);
    expect(solved, `search solved ${solved} positions`).toBeLessThan(20_000);
  });
});
