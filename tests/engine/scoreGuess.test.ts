import { describe, expect, it } from 'vitest';

import { NO_CONSTRAINTS } from '../../src/engine/rules/constraints';
import { hardRuleset, normalRuleset } from '../../src/engine/rules/ruleset';
import { createPositionScorer } from '../../src/engine/score/scoreGuess';
import { buildPatternMatrix } from '../../src/engine/search/matrix';
import { bruteForcePolicy, validatedPolicy } from '../../src/engine/search/policy';
import { createSearcher } from '../../src/engine/search/value';
import { compileLexicon, type Lexicon } from '../../src/engine/words/lexicon';
import { computePattern } from '../../src/engine/words/pattern';
import {
  FORCED_LEXICON,
  SINGLE_WORD_LEXICON,
  TWO_CANDIDATE_LEXICON,
} from '../support/lexicons';
import { observationsFor } from '../support/positions';

/**
 * Spec §10's scorer checks, which are the sharpest statements in the document
 * about what the score is supposed to mean.
 *
 * Every expectation here is `toBe`, never `toBeCloseTo`. The values are exact
 * rationals — 3/2 and 2 and their ratio — and asserting them exactly is the only
 * way the test can notice that the arithmetic drifted.
 */

function scorerFor(
  lexicon: Lexicon,
  ruleset = normalRuleset,
  policy = bruteForcePolicy,
) {
  return createPositionScorer({ lexicon: compileLexicon(lexicon), ruleset, policy });
}

describe('one candidate left', () => {
  const scorer = scorerFor(TWO_CANDIDATE_LEXICON);
  // batch against catch returns ⬜🟩🟩🟩🟩, and of batch, catch and plumb only
  // catch survives.
  const history = observationsFor('catch', ['batch']);

  it('leaves exactly one candidate', () => {
    expect(scorer.candidatesAfter(history)).toEqual(['catch']);
  });

  it('scores 100 for guessing it', () => {
    // Spec §10, and spec §3 adds that its aggregation weight is log2(1) = 0, so
    // it contributes nothing to the average either way.
    expect(scorer.scoreGuess(history, 'catch').skill).toBe(100);
  });

  it('labels it forced, because there was nothing to choose between', () => {
    expect(scorer.scoreGuess(history, 'catch').forced).toBe(true);
  });

  it('does not give 100 to a guess that throws the turn away', () => {
    // The position was winnable in one and the player took two, so half marks.
    // Not zero: the guess was wasteful, not illegal.
    expect(scorer.scoreGuess(history, 'bongo').skill).toBe(50);
    expect(scorer.scoreGuess(history, 'bongo').forced).toBe(false);
  });

  it('reports no expected information, since there is nothing left to learn', () => {
    expect(scorer.scoreGuess(history, 'catch').expectedBits).toBe(0);
  });
});

describe('two candidates left', () => {
  const scorer = scorerFor(TWO_CANDIDATE_LEXICON);
  // match against catch returns ⬜🟩🟩🟩🟩, leaving batch and catch.
  const history = observationsFor('catch', ['match']);

  it('leaves exactly two candidates', () => {
    expect(scorer.candidatesAfter(history)).toEqual(['batch', 'catch']);
  });

  it.each(['batch', 'catch'])('scores exactly 100 for guessing %s', (guess) => {
    // Either candidate wins half the time and finishes next turn otherwise, so
    // Q = 1 + 1/2 = 3/2 for both. Neither is better than the other.
    expect(scorer.scoreGuess(history, guess).skill).toBe(100);
  });

  it.each(['bongo', 'plumb'])(
    'scores exactly 75 for %s, which separates them but cannot win',
    (guess) => {
      // Spec §10: "This one matters: it's the check that the scorer values
      // finishing, not just information." Both guesses learn a full bit, exactly
      // as much as a candidate does, and are still worth a quarter less — because
      // Q = 2 against Q = 3/2, and 100 × (3/2) / 2 = 75.
      const score = scorer.scoreGuess(history, guess);

      expect(score.skill).toBe(75);
      expect(score.expectedBits).toBe(1);
      expect(score.forced).toBe(false);
    },
  );

  it('labels a candidate guess forced, because the choice between them is a coin flip', () => {
    // Decision 0001: forced-move labelling covers the coin flip, not just the
    // single-legal-guess case. Philosophy position 12's motivating player is the
    // one who picks between two words and is unlucky; the label is how the
    // results page says the miss was not a mistake.
    expect(scorer.scoreGuess(history, 'batch').forced).toBe(true);
    expect(scorer.scoreGuess(history, 'catch').forced).toBe(true);
  });

  it('scores a guess that separates nothing without dropping it to zero', () => {
    // haste returns 🟨🟩⬜🟨⬜ against both candidates, so it is spec §3's
    // non-splitting guess: infinitely bad *to select*, but the player played it,
    // and §3 also says scores land in (0, 100]. Resolving the recursion as
    // "waste this turn, then play the same position properly" gives
    // Q = 1 + 3/2 = 5/2, and 100 × (3/2) / (5/2) = 60.
    expect(scorer.scoreGuess(history, 'haste').skill).toBe(60);
    expect(scorer.scoreGuess(history, 'haste').expectedBits).toBe(0);
  });

  it('treats replaying an earlier guess the same way, since it splits nothing either', () => {
    expect(scorer.scoreGuess(history, 'match').skill).toBe(60);
  });
});

describe('a forced move with only one legal guess', () => {
  // Spec §10's own wording. Reaching it needs a history guess outside the
  // dictionary — `grace` here — because a played guess always satisfies the
  // constraints it generated and so does every surviving candidate, which means a
  // live position whose history is all dictionary words always leaves at least
  // two legal guesses. The case is real but unreachable in play, which is why
  // decision 0001 has the coin flip carry the label in practice.
  const scorer = scorerFor(FORCED_LEXICON, hardRuleset);
  const history = observationsFor('crane', ['grace']);

  it('leaves one candidate and one legal guess', () => {
    expect(scorer.candidatesAfter(history)).toEqual(['crane']);

    const compiled = compileLexicon(FORCED_LEXICON);
    const constraints = history.reduce(
      (prior, observation) => hardRuleset.accumulate(prior, observation),
      hardRuleset.initialConstraints,
    );
    const legal = FORCED_LEXICON.guesses.filter((word) =>
      hardRuleset.isLegal(constraints, word),
    );

    expect(legal).toEqual(['crane']);
    expect(compiled.guessCount).toBe(3);
  });

  it('scores 100 and says so', () => {
    // Spec §6: hard mode changes only the legal set, never the formula, so a
    // forced move scores 100 on its own rather than by a special case.
    const score = scorer.scoreGuess(history, 'crane');

    expect(score.skill).toBe(100);
    expect(score.forced).toBe(true);
  });

  it('refuses to score an illegal guess rather than scoring it badly', () => {
    expect(() => scorer.scoreGuess(history, 'brine')).toThrow(/not legal in hard mode/);
  });
});

describe('the degenerate one-word lexicon', () => {
  it('scores the only word 100 with no history at all', () => {
    const scorer = scorerFor(SINGLE_WORD_LEXICON);
    const score = scorer.scoreGuess([], 'crane');

    expect(score.skill).toBe(100);
    expect(score.candidateCount).toBe(1);
    expect(score.forced).toBe(true);
  });
});

describe('the values behind those scores', () => {
  // The same claims, one level down, so a failure says whether the search or the
  // ratio was wrong.
  const compiled = compileLexicon(TWO_CANDIDATE_LEXICON);
  const columns = Int32Array.from([0, 1]);
  const matrix = buildPatternMatrix(compiled, columns);
  const searcher = createSearcher(
    { lexicon: compiled, ruleset: normalRuleset, policy: bruteForcePolicy },
    matrix,
  );

  const cost = (guess: string) =>
    searcher.costOf(compiled.guessIndexOf(guess), columns, NO_CONSTRAINTS);

  it('values a two-candidate position at exactly three halves', () => {
    expect(searcher.valueOf(columns, NO_CONSTRAINTS)).toBe(1.5);
  });

  it('costs a candidate three halves and a separating probe exactly two', () => {
    expect(cost('batch')).toBe(1.5);
    expect(cost('catch')).toBe(1.5);
    expect(cost('bongo')).toBe(2);
  });

  it('costs a non-splitting guess infinity, so it can never be selected', () => {
    // Guard clause 2. The scorer turns this into 1 + V rather than a zero, but
    // the search itself has to see it as unselectable or it would recurse for
    // ever on an unchanged position.
    expect(cost('haste')).toBe(Number.POSITIVE_INFINITY);
  });

  it('values a one-candidate position at exactly one', () => {
    const single = Int32Array.from([1]);
    const singleMatrix = buildPatternMatrix(compiled, single);
    const solver = createSearcher(
      { lexicon: compiled, ruleset: normalRuleset, policy: bruteForcePolicy },
      singleMatrix,
    );

    expect(solver.valueOf(single, NO_CONSTRAINTS)).toBe(1);
  });

  it('short-circuits the endgame to the same values the search would find', () => {
    // The search settles one- and two-candidate positions by argument instead of
    // by ranking the dictionary, because that is where the node count
    // concentrates. The shortcut is only sound if it agrees with the recursion,
    // and every exact figure above depends on it: 100 against 75 is (3/2) / 2,
    // and the non-splitting 60 is (3/2) / (5/2).
    expect(searcher.valueOf(Int32Array.from([0]), NO_CONSTRAINTS)).toBe(1);
    expect(searcher.valueOf(Int32Array.from([0, 1]), NO_CONSTRAINTS)).toBe(1.5);

    // And it is reached through the recursion too, not only at the root: a
    // separating probe's cost is 1 + (1·V{batch} + 1·V{catch}) / 2, which is 2
    // exactly when both children come back as 1.
    expect(cost('bongo')).toBe(2);
  });
});

describe('what the scorer is not told, and does not say', () => {
  const scorer = scorerFor(TWO_CANDIDATE_LEXICON);
  const history = observationsFor('catch', ['match']);

  it('never returns the best guess', () => {
    // Spec §10: never reveal the optimal word. The surest way to keep a secret
    // out of a UI is for the value it would be read from not to exist, so the
    // result carries no argmin and no word at all.
    const score = scorer.scoreGuess(history, 'bongo');

    expect(Object.keys(score).sort()).toEqual([
      'candidateCount',
      'expectedBits',
      'forced',
      'skill',
    ]);
    for (const value of Object.values(score)) {
      expect(typeof value).not.toBe('string');
    }
  });

  it('scores a guess without being told the answer or its feedback', () => {
    // Structural, not a convention: the same two arguments produce the same score
    // whichever of the live candidates turns out to be the answer, because the
    // function has no way to find out.
    const asBatch = scorerFor(TWO_CANDIDATE_LEXICON).scoreGuess(
      observationsFor('batch', ['match']),
      'bongo',
    );
    const asCatch = scorerFor(TWO_CANDIDATE_LEXICON).scoreGuess(
      observationsFor('catch', ['match']),
      'bongo',
    );

    expect(computePattern('match', 'batch')).toBe(computePattern('match', 'catch'));
    expect(asBatch).toEqual(asCatch);
  });

  it('rejects a guess outside the dictionary rather than guessing what was meant', () => {
    expect(() => scorer.scoreGuess(history, 'zzzzz')).toThrow(/guess dictionary/);
  });

  it('rejects a history no answer can explain', () => {
    expect(() =>
      scorer.scoreGuess([{ guess: 'batch', pattern: 0 }], 'catch'),
    ).toThrow(/rules out every possible answer/);
  });
});

describe('the approximate policy on these positions', () => {
  it('agrees with brute force everywhere the answer is checkable by hand', () => {
    const brute = scorerFor(TWO_CANDIDATE_LEXICON, normalRuleset, bruteForcePolicy);
    const validated = scorerFor(TWO_CANDIDATE_LEXICON, normalRuleset, validatedPolicy);
    const history = observationsFor('catch', ['match']);

    for (const guess of TWO_CANDIDATE_LEXICON.guesses) {
      expect(validated.scoreGuess(history, guess)).toEqual(
        brute.scoreGuess(history, guess),
      );
    }
  });
});
