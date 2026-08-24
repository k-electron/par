/**
 * Spec §3's aggregation and outcome terms, and the §10 checks that live here.
 */

import { describe, expect, it } from 'vitest';

import { C_PAR, EPSILON, PAR, UNSOLVED_GUESSES } from '../../src/engine/config/constants';
import { hardRuleset, normalRuleset } from '../../src/engine/rules/ruleset';
import { outcomePoints, scoreGame } from '../../src/engine/score/scoreGame';
import { createPositionScorer } from '../../src/engine/score/scoreGuess';
import { bruteForcePolicy, validatedPolicy } from '../../src/engine/search/policy';
import { compileLexicon } from '../../src/engine/words/lexicon';
import type { Ruleset } from '../../src/engine/rules/ruleset';

/**
 * A small closed world. Real enough to produce genuine branching, small enough
 * that brute force can confirm every number.
 */
const WORDS = [
  'batch', 'catch', 'hatch', 'latch', 'match', 'patch', 'watch',
  'brine', 'crane', 'drone', 'plumb', 'shirt', 'grove', 'stomp',
];

const lexicon = compileLexicon({ guesses: WORDS, answers: WORDS });

function scorerFor(ruleset: Ruleset = normalRuleset, policy = bruteForcePolicy) {
  return createPositionScorer({ lexicon, ruleset, policy });
}

describe('outcomePoints', () => {
  it('is the only conversion from guesses to points, and it is linear', () => {
    // Spec §10's payout-shape check: constant differences. A convex curve would
    // pay for variance, which anyone can manufacture by guessing recklessly.
    const points = [1, 2, 3, 4, 5, 6].map((n) => outcomePoints(n, true));
    const steps = points.slice(1).map((value, index) => value - points[index]!);

    expect(new Set(steps)).toEqual(new Set([-C_PAR]));
  });

  it('prices par at zero', () => {
    expect(outcomePoints(PAR, true)).toBe(0);
  });

  it('prices an unsolved game as seven guesses', () => {
    // Without the floor, losing would pay the same as a six-guess solve.
    expect(outcomePoints(6, false)).toBe(C_PAR * (PAR - UNSOLVED_GUESSES));
    expect(outcomePoints(6, false)).toBeLessThan(outcomePoints(6, true));
  });

  it('never pays more for being slower', () => {
    for (let n = 1; n < 6; n += 1) {
      expect(outcomePoints(n, true)).toBeGreaterThan(outcomePoints(n + 1, true));
    }
  });
});

describe('guess 1 is never skill-scored', () => {
  it('contributes nothing under the custom-opener path', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'crane'], answer: 'crane', tookHouseStarter: false },
      scorer,
    );

    expect(score.breakdown[0]?.skill).toBeNull();
    expect(score.breakdown[0]?.weight).toBe(0);
  });

  it('contributes nothing under the house-starter path either', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['shirt', 'crane'], answer: 'crane', tookHouseStarter: true },
      scorer,
    );

    expect(score.breakdown[0]?.skill).toBeNull();
    expect(score.breakdown[0]?.weight).toBe(0);
  });

  it('gives the same skill however good or bad the opener was', () => {
    // The opener expresses itself through the position it creates, which the
    // outcome term prices. It must not also be graded.
    const scorer = scorerFor();
    const strong = scoreGame(
      { guesses: ['crane', 'batch'], answer: 'batch', tookHouseStarter: false },
      scorer,
    );
    const weak = scoreGame(
      { guesses: ['stomp', 'batch'], answer: 'batch', tookHouseStarter: false },
      scorer,
    );

    expect(strong.breakdown[0]?.skill).toBeNull();
    expect(weak.breakdown[0]?.skill).toBeNull();
  });
});

describe('the skill average', () => {
  it('is 100 when no guess qualified', () => {
    // Spec §3's base case. A two-guess solve whose opener left one candidate
    // has nothing to average, and 0/0 would otherwise reach the total.
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['crane'], answer: 'crane', tookHouseStarter: false },
      scorer,
    );

    expect(score.skill).toBe(100);
    expect(Number.isNaN(score.total)).toBe(false);
  });

  it('weights a guess by log2 of the candidates it faced', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'batch', 'catch'], answer: 'catch', tookHouseStarter: false },
      scorer,
    );

    const scored = score.breakdown.filter((row) => row.skill !== null);
    for (const row of scored) {
      expect(row.weight).toBeCloseTo(Math.log2(row.candidateCount), 10);
    }
  });

  it('gives a singleton position no weight', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'batch', 'catch', 'hatch'], answer: 'hatch', tookHouseStarter: false },
      scorer,
    );

    for (const row of score.breakdown) {
      if (row.candidateCount === 1) expect(row.weight).toBe(0);
    }
  });

  it('lands in (0, 100]', () => {
    const scorer = scorerFor();
    for (const answer of WORDS) {
      const score = scoreGame(
        { guesses: ['plumb', 'batch', answer], answer, tookHouseStarter: false },
        scorer,
      );
      expect(score.skill).toBeGreaterThan(0);
      expect(score.skill).toBeLessThanOrEqual(100);
    }
  });
});

describe('the total', () => {
  it('is skill plus outcome plus the bonus', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'batch', 'catch'], answer: 'catch', tookHouseStarter: true },
      scorer,
    );

    expect(score.total).toBeCloseTo(score.skill + score.outcome + EPSILON, 10);
    expect(score.starterBonus).toBe(EPSILON);
  });

  it('pays the bonus for the toggle, not for the word', () => {
    // Spec §6: a player who declines the house starter and happens to type the
    // same word earns nothing. Paying on the word would reward the bookmark
    // habit the bonus exists to tax.
    const scorer = scorerFor();
    const shared = { guesses: ['shirt', 'crane'], answer: 'crane' } as const;

    expect(scoreGame({ ...shared, tookHouseStarter: false }, scorer).starterBonus).toBe(0);
    expect(scoreGame({ ...shared, tookHouseStarter: true }, scorer).starterBonus).toBe(EPSILON);
  });

  it('prices a loss below any solve', () => {
    const scorer = scorerFor();
    const lost = scoreGame(
      {
        guesses: ['plumb', 'shirt', 'grove', 'stomp', 'brine', 'drone'],
        answer: 'catch',
        tookHouseStarter: false,
      },
      scorer,
    );

    expect(lost.solved).toBe(false);
    expect(lost.outcome).toBe(outcomePoints(6, false));
  });

  it('stops at the winning guess', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['crane', 'batch', 'catch'], answer: 'crane', tookHouseStarter: false },
      scorer,
    );

    expect(score.guessesUsed).toBe(1);
    expect(score.breakdown).toHaveLength(1);
    expect(score.solved).toBe(true);
  });
});

describe('the luck figure', () => {
  it('is reported for guess 1, which skill deliberately ignores', () => {
    // Spec §3 asks for it explicitly: it is the honest explanation for a fast
    // finish, and never a grade on the opener choice.
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'crane'], answer: 'crane', tookHouseStarter: false },
      scorer,
    );

    expect(score.breakdown[0]?.skill).toBeNull();
    expect(Number.isFinite(score.breakdown[0]?.luck)).toBe(true);
  });

  it('never reaches the total', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['plumb', 'batch', 'catch'], answer: 'catch', tookHouseStarter: false },
      scorer,
    );

    // Rebuilding the total from its three named parts must reproduce it
    // exactly, which it cannot if luck leaked in anywhere.
    expect(score.total).toBeCloseTo(score.skill + score.outcome + score.starterBonus, 12);
  });

  it('is higher the harder the feedback cut', () => {
    // The same opener against two answers. CRANE leaves a handful; CATCH drops
    // it into the seven-way -ATCH family, which is the worst bucket available.
    const scorer = scorerFor();
    const sharp = scoreGame(
      { guesses: ['batch', 'crane'], answer: 'crane', tookHouseStarter: false },
      scorer,
    );
    const blunt = scoreGame(
      { guesses: ['batch', 'catch'], answer: 'catch', tookHouseStarter: false },
      scorer,
    );

    expect(sharp.breakdown[0]!.luck).toBeGreaterThan(blunt.breakdown[0]!.luck);
    // Landing in the largest bucket a guess has is unlucky by definition.
    expect(blunt.breakdown[0]!.luck).toBeLessThan(0);
  });

  it('averages out across every answer a guess could face', () => {
    // Expectation is expectation: weighting each outcome's luck by how often it
    // happens has to come back to zero, or the figure is measuring the wrong
    // thing.
    const scorer = scorerFor();
    let weighted = 0;
    for (const answer of WORDS) {
      const score = scoreGame(
        { guesses: ['batch', answer], answer, tookHouseStarter: false },
        scorer,
      );
      weighted += score.breakdown[0]!.luck;
    }
    expect(weighted / WORDS.length).toBeCloseTo(0, 10);
  });
});

/**
 * The three display-only figures decision 0005 added, so the explainer can say
 * why a row scored what it did rather than restating the ratio.
 *
 * They are checked here rather than through the copy because they are claims
 * about the position, and a sentence that is true of the wrong number is worse
 * than one that is merely clumsy.
 */
describe('what each guess was doing', () => {
  it('separates a live shot from a word that could not win', () => {
    const scorer = scorerFor();
    // PLUMB shares nothing with the -ATCH family, so after BATCH it is ruled
    // out and can only ask a question. CATCH is still standing.
    const score = scoreGame(
      { guesses: ['batch', 'plumb', 'catch'], answer: 'catch', tookHouseStarter: false },
      scorer,
    );

    expect(score.breakdown[1]!.wasCandidate).toBe(false);
    expect(score.breakdown[2]!.wasCandidate).toBe(true);
  });

  it('reports both shares as shares, never as counts', () => {
    const scorer = scorerFor();
    const score = scoreGame(
      { guesses: ['batch', 'crane', 'plumb'], answer: 'plumb', tookHouseStarter: false },
      scorer,
    );

    for (const row of score.breakdown) {
      expect(row.outcomeShare).toBeGreaterThan(0);
      expect(row.outcomeShare).toBeLessThanOrEqual(1);
      expect(row.likeliestOutcomeShare).toBeGreaterThan(0);
      expect(row.likeliestOutcomeShare).toBeLessThanOrEqual(1);
      // The realized bucket is one of the buckets, so it cannot beat the
      // biggest one. The explainer reads equality as "the tiles came back the
      // likeliest way", and that reading is only sound while this holds.
      expect(row.outcomeShare).toBeLessThanOrEqual(row.likeliestOutcomeShare);
      // Both are `k / |S_i|` for the same denominator, which is what makes the
      // equality test above exact rather than a floating-point coin toss.
      expect(row.outcomeShare).toBe(row.remainingCount / row.candidateCount);
      expect(row.likeliestOutcomeShare * row.candidateCount).toBeCloseTo(
        Math.round(row.likeliestOutcomeShare * row.candidateCount),
        10,
      );
    }
  });

  it('ties landing in the likeliest bucket to the luck figure being unkind', () => {
    // The two are the same fact seen twice: the biggest bucket is the least
    // informative outcome, so realized bits are at their lowest there and luck
    // cannot come out positive. The explainer says so in one breath, and would
    // be lying on any round where this failed.
    const scorer = scorerFor();

    for (const answer of WORDS) {
      const score = scoreGame(
        { guesses: ['batch', 'crane', answer], answer, tookHouseStarter: false },
        scorer,
      );

      for (const row of score.breakdown) {
        if (row.outcomeShare >= row.likeliestOutcomeShare && row.candidateCount > 1) {
          expect(row.luck, `${row.guess} on ${answer}`).toBeLessThanOrEqual(0);
        }
      }
    }
  });
});

describe('hard mode', () => {
  it('never scores below what was legally achievable', () => {
    // Spec §10, and the substance of it: hard mode restricts the legal set for
    // the benchmark as well as for the player. Judging a hard-mode guess against
    // the best word in the *whole* dictionary would penalise a player for a
    // restriction the rules imposed on them, which philosophy position 12 rules
    // out — "a player forced into a coin flip by the rules played perfectly".
    //
    // Asserting `skill > 0 && skill <= 100` would prove nothing, because that
    // holds for every score the system can produce in either mode. So this
    // compares the two benchmarks directly.
    const game = {
      guesses: ['batch', 'catch', 'hatch'],
      answer: 'hatch',
      tookHouseStarter: false,
    } as const;

    const hard = scoreGame(game, scorerFor(hardRuleset));
    const normal = scoreGame(game, scorerFor(normalRuleset));

    // The same guesses, in the mode that removes options, must never be judged
    // more harshly than in the mode that keeps them all.
    const hardRows = hard.breakdown.filter((row) => row.skill !== null);
    const normalRows = normal.breakdown.filter((row) => row.skill !== null);
    expect(hardRows).toHaveLength(normalRows.length);

    for (const [index, row] of hardRows.entries()) {
      expect(row.skill!, `turn ${row.turn}`).toBeGreaterThanOrEqual(normalRows[index]!.skill!);
    }
    expect(hard.skill).toBeGreaterThanOrEqual(normal.skill);
  });

  it('scores a coin flip 100 and says it was forced', () => {
    // Hard mode holds -ATCH green, so every legal guess is another member of
    // the seven-word family and each one eliminates only itself. Walking down
    // it leaves HATCH and WATCH alive on the final turn: a pure coin flip that
    // the rules imposed.
    //
    // Philosophy position 12 is explicit that such a player "played perfectly,
    // and should be told so" — so the 100 is not enough on its own, the
    // breakdown has to mark it unavoidable rather than earned.
    const score = scoreGame(
      {
        guesses: ['batch', 'catch', 'latch', 'match', 'patch', 'hatch'],
        answer: 'hatch',
        tookHouseStarter: false,
      },
      scorerFor(hardRuleset),
    );

    const coinFlip = score.breakdown.at(-1)!;
    expect(coinFlip.guess).toBe('hatch');
    expect(coinFlip.candidateCount).toBe(2);
    expect(coinFlip.skill).toBe(100);
    expect(coinFlip.forced).toBe(true);
  });

  it('uses the same formula as normal mode', () => {
    // Only the legal set differs, so an identical game in the two modes differs
    // only where legality bit — never in how the numbers are combined.
    const game = {
      guesses: ['batch', 'catch'],
      answer: 'catch',
      tookHouseStarter: false,
    } as const;

    const normal = scoreGame(game, scorerFor(normalRuleset));
    const hard = scoreGame(game, scorerFor(hardRuleset));

    expect(hard.outcome).toBe(normal.outcome);
    expect(hard.guessesUsed).toBe(normal.guessesUsed);
  });
});

describe('determinism', () => {
  it('scores a game identically on every run', () => {
    const game = {
      guesses: ['plumb', 'batch', 'catch'],
      answer: 'catch',
      tookHouseStarter: true,
    } as const;

    const first = scoreGame(game, scorerFor());
    const second = scoreGame(game, scorerFor());

    // Bit-identical, not merely close: a replay link that disagrees in the last
    // decimal defeats the point of comparing scores at all.
    expect(second.total).toBe(first.total);
    expect(second.skill).toBe(first.skill);
    expect(second.breakdown.map((row) => row.skill)).toEqual(
      first.breakdown.map((row) => row.skill),
    );
  });

  it('agrees between the validated ladder and brute force', () => {
    const game = {
      guesses: ['plumb', 'batch', 'catch'],
      answer: 'catch',
      tookHouseStarter: false,
    } as const;

    const exact = scoreGame(game, scorerFor(normalRuleset, bruteForcePolicy));
    const shipped = scoreGame(game, scorerFor(normalRuleset, validatedPolicy));

    expect(shipped.total).toBe(exact.total);
  });
});

describe('golden totals', () => {
  // Pinned so a refactor that quietly changes a score gets caught.
  //
  // These move whenever `PAR` is recomputed, because the outcome term is
  // measured against it. That is intended rather than annoying: regenerating
  // the word lists shifts every total, and the snapshot forces someone to look
  // at the new numbers instead of finding out from a player.
  const scorer = scorerFor();

  it.each([
    [['plumb', 'batch', 'catch'], 'catch', false],
    [['batch', 'catch'], 'catch', true],
    [['crane'], 'crane', false],
  ] as const)('%s against %s stays put', (guesses, answer, took) => {
    const score = scoreGame({ guesses: [...guesses], answer, tookHouseStarter: took }, scorer);
    expect({
      skill: Number(score.skill.toFixed(6)),
      outcome: Number(score.outcome.toFixed(6)),
      total: Number(score.total.toFixed(6)),
    }).toMatchSnapshot();
  });
});
