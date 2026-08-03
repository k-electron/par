import { describe, expect, it } from 'vitest';

import {
  NO_CONSTRAINTS,
  constraintKey,
  isUnconstrained,
  type Constraints,
} from '../../src/engine/rules/constraints';
import { hardRuleset, normalRuleset, rulesetFor } from '../../src/engine/rules/ruleset';
import { filterByHistory, type Observation } from '../../src/engine/words/filter';
import { compileLexicon } from '../../src/engine/words/lexicon';
import { computePattern } from '../../src/engine/words/pattern';
import { FIXTURE_LEXICON } from '../support/lexicons';
import { observationsFor, permuted } from '../support/positions';

/**
 * Spec §3 and docs/philosophy.md position 12: hard mode changes only the legal
 * set, never the formula. So the only thing a Ruleset may decide is which words
 * may be played, and these tests are about exactly that.
 */

function constraintsAfter(history: readonly Observation[]): Constraints {
  return history.reduce(
    (prior, observation) => hardRuleset.accumulate(prior, observation),
    hardRuleset.initialConstraints,
  );
}

function legalWords(constraints: Constraints): string[] {
  return FIXTURE_LEXICON.guesses.filter((word) => hardRuleset.isLegal(constraints, word));
}

describe('normal mode', () => {
  it('leaves every dictionary word legal all game', () => {
    const constraints = [
      { guess: 'crane', pattern: computePattern('crane', 'watch') },
      { guess: 'batch', pattern: computePattern('batch', 'watch') },
    ].reduce(
      (prior, observation) => normalRuleset.accumulate(prior, observation),
      normalRuleset.initialConstraints,
    );

    for (const word of FIXTURE_LEXICON.guesses) {
      expect(normalRuleset.isLegal(constraints, word)).toBe(true);
    }
  });

  it('accumulates nothing, so the search memo keys on the candidate set alone', () => {
    const constraints = normalRuleset.accumulate(normalRuleset.initialConstraints, {
      guess: 'crane',
      pattern: computePattern('crane', 'watch'),
    });

    expect(isUnconstrained(constraints)).toBe(true);
    expect(constraintKey(constraints)).toBe('');
  });

  it('reports that legality never depends on constraints', () => {
    expect(normalRuleset.restrictsLegalGuesses).toBe(false);
    expect(hardRuleset.restrictsLegalGuesses).toBe(true);
  });

  it('is what rulesetFor returns for anything but hard', () => {
    expect(rulesetFor('normal')).toBe(normalRuleset);
    expect(rulesetFor('hard')).toBe(hardRuleset);
  });
});

describe('hard mode', () => {
  it('requires a revealed green to be reused in position', () => {
    // batch against catch returns ⬜🟩🟩🟩🟩, fixing a, t, c and h.
    const constraints = constraintsAfter(observationsFor('catch', ['batch']));

    expect(hardRuleset.isLegal(constraints, 'catch')).toBe(true);
    expect(hardRuleset.isLegal(constraints, 'match')).toBe(true);
    expect(hardRuleset.isLegal(constraints, 'haste')).toBe(false);
    expect(hardRuleset.isLegal(constraints, 'crane')).toBe(false);
  });

  it('requires a revealed letter as many times as it was hinted', () => {
    // speed against erase returns 🟨⬜🟨🟨⬜: two yellow e's and one yellow s,
    // so a legal guess needs two e's and an s, wherever they sit.
    const constraints = constraintsAfter([
      { guess: 'speed', pattern: computePattern('speed', 'erase') },
    ]);

    expect(hardRuleset.isLegal(constraints, 'erase')).toBe(true);
    expect(hardRuleset.isLegal(constraints, 'sheep')).toBe(true);
    expect(hardRuleset.isLegal(constraints, 'stare')).toBe(false);
    expect(hardRuleset.isLegal(constraints, 'three')).toBe(false);
  });

  it('lets a grey letter be played again, which is the rule people misremember', () => {
    // speed against abide returns ⬜⬜🟨⬜🟨: s and p come back grey, so spied
    // stays legal as long as it carries the e and the d.
    const constraints = constraintsAfter([
      { guess: 'speed', pattern: computePattern('speed', 'abide') },
    ]);

    expect(hardRuleset.isLegal(constraints, 'spied')).toBe(true);
    expect(hardRuleset.isLegal(constraints, 'spice')).toBe(false);
  });

  it('leaves every dictionary word legal before anything has been played', () => {
    expect(isUnconstrained(hardRuleset.initialConstraints)).toBe(true);
    for (const word of FIXTURE_LEXICON.guesses) {
      expect(hardRuleset.isLegal(hardRuleset.initialConstraints, word)).toBe(true);
    }
  });
});

describe('accumulating constraints', () => {
  it('only ever narrows, which is what lets the search filter its parent set', () => {
    for (const answer of FIXTURE_LEXICON.answers) {
      const history = observationsFor(answer, ['crane', 'batch']);
      const afterOne = legalWords(constraintsAfter(history.slice(0, 1)));
      const afterTwo = legalWords(constraintsAfter(history));

      expect(afterTwo.every((word) => afterOne.includes(word))).toBe(true);
    }
  });

  it('does not depend on the order the observations arrive in', () => {
    for (const answer of FIXTURE_LEXICON.answers) {
      const history = observationsFor(answer, ['crane', 'batch', 'sound']);

      expect(constraintKey(constraintsAfter(permuted(history)))).toBe(
        constraintKey(constraintsAfter(history)),
      );
    }
  });

  it('is idempotent, so replaying an observation changes nothing', () => {
    const history = observationsFor('watch', ['batch']);
    const once = constraintsAfter(history);
    const twice = constraintsAfter([...history, ...history]);

    expect(constraintKey(twice)).toBe(constraintKey(once));
  });

  it('never mutates the constraints it was handed', () => {
    const before = constraintKey(NO_CONSTRAINTS);
    hardRuleset.accumulate(NO_CONSTRAINTS, {
      guess: 'crane',
      pattern: computePattern('crane', 'crane'),
    });

    expect(constraintKey(NO_CONSTRAINTS)).toBe(before);
    expect(isUnconstrained(NO_CONSTRAINTS)).toBe(true);
  });
});

describe('every candidate stays legal in hard mode', () => {
  it('holds for every answer and every opening guess in the fixture', () => {
    // Spec §3 asserts this in passing — "a candidate guess is always legal" —
    // and the value of a two-candidate position depends on it. It also means a
    // position can never have fewer legal guesses than it has candidates.
    for (const answer of FIXTURE_LEXICON.answers) {
      for (const guess of FIXTURE_LEXICON.guesses) {
        const history = observationsFor(answer, [guess]);
        const constraints = constraintsAfter(history);

        for (const candidate of filterByHistory(FIXTURE_LEXICON.answers, history)) {
          expect(hardRuleset.isLegal(constraints, candidate)).toBe(true);
        }
      }
    }
  });
});

describe('hard-mode legality from guess 2 onward', () => {
  // Spec §6 and decision 0001: it applies from guess 2 onward "including when
  // guess 1 was the house starter". The engine has no notion of who chose a
  // guess — constraints are a function of (guess, pattern) and nothing else —
  // so there is no path for the house starter to take that skips the rule.
  const houseStarter = 'slate';

  it('constrains guess 2 after the house starter was played as guess 1', () => {
    const constraints = constraintsAfter(observationsFor('watch', [houseStarter]));
    const legal = legalWords(constraints);

    expect(isUnconstrained(constraints)).toBe(false);
    expect(legal.length).toBeLessThan(FIXTURE_LEXICON.guesses.length);
    expect(legal).toContain('watch');
  });

  it("constrains it identically whether the opener was the house word or the player's own", () => {
    const houseOpening = constraintsAfter(observationsFor('watch', [houseStarter]));
    const sameWordByChoice = constraintsAfter([
      { guess: houseStarter, pattern: computePattern(houseStarter, 'watch') },
    ]);

    expect(constraintKey(sameWordByChoice)).toBe(constraintKey(houseOpening));
  });
});

describe('the constraint key', () => {
  it('is empty exactly when nothing is constrained', () => {
    expect(constraintKey(NO_CONSTRAINTS)).toBe('');
    expect(constraintKey(constraintsAfter(observationsFor('watch', ['batch'])))).not.toBe('');
  });

  it('separates every distinct constraint set the fixture can reach', () => {
    // The search memo keys on the candidate set and this string, exactly rather
    // than by hash, so two different constraint sets sharing a key would
    // silently corrupt a score.
    const byKey = new Map<string, string>();

    for (const answer of FIXTURE_LEXICON.answers) {
      for (const guess of FIXTURE_LEXICON.guesses) {
        const constraints = constraintsAfter(observationsFor(answer, [guess]));
        const key = constraintKey(constraints);
        const legal = legalWords(constraints).join(' ');
        const seen = byKey.get(key);

        if (seen === undefined) {
          byKey.set(key, legal);
        } else {
          expect(seen).toBe(legal);
        }
      }
    }

    expect(byKey.size).toBeGreaterThan(50);
  });
});

describe('narrowing a legal set', () => {
  const compiled = compileLexicon(FIXTURE_LEXICON);

  it('agrees with isLegal and keeps the dictionary order', () => {
    const all = Int32Array.from({ length: compiled.guessCount }, (_, index) => index);
    const into = new Int32Array(compiled.guessCount);
    const constraints = constraintsAfter(observationsFor('catch', ['batch']));

    const written = hardRuleset.narrow(
      constraints,
      compiled.guessLetters,
      all,
      compiled.guessCount,
      into,
    );

    const narrowed = [...into.subarray(0, written)].map(
      (index) => compiled.guessWords[index]!,
    );

    expect(narrowed).toEqual(legalWords(constraints));
  });

  it('narrows to everything in normal mode', () => {
    const all = Int32Array.from({ length: compiled.guessCount }, (_, index) => index);
    const into = new Int32Array(compiled.guessCount);

    const written = normalRuleset.narrow(
      NO_CONSTRAINTS,
      compiled.guessLetters,
      all,
      compiled.guessCount,
      into,
    );

    expect(written).toBe(compiled.guessCount);
    expect([...into]).toEqual([...all]);
  });
});
