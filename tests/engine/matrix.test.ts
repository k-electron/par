import { describe, expect, it } from 'vitest';

import { compileLexicon } from '../../src/engine/words/lexicon';
import { computePattern } from '../../src/engine/words/pattern';
import { buildPatternMatrix } from '../../src/engine/search/matrix';
import { FIXTURE_LEXICON, TWO_CANDIDATE_LEXICON } from '../support/lexicons';

/**
 * The matrix is an optimisation, so the only thing worth asserting about it is
 * that it changed nothing. Its fast duplicate handling is written differently
 * from the reference implementation — shared count slots for repeated letters
 * rather than a 26-slot table — so the agreement below is what stops the
 * optimisation from quietly becoming a different set of rules.
 */

describe('the per-game pattern matrix', () => {
  const compiled = compileLexicon(FIXTURE_LEXICON);
  const everyAnswer = Int32Array.from({ length: compiled.answerCount }, (_, i) => i);
  const matrix = buildPatternMatrix(compiled, everyAnswer);

  it('agrees with the reference feedback on every pair', () => {
    for (let guess = 0; guess < compiled.guessCount; guess += 1) {
      for (let column = 0; column < matrix.width; column += 1) {
        const expected = computePattern(
          compiled.guessWords[guess]!,
          compiled.answerWords[matrix.answers[column]!]!,
        );

        expect(
          matrix.patterns[guess * matrix.width + column],
          `${compiled.guessWords[guess]} against ${compiled.answerWords[column]}`,
        ).toBe(expected);
      }
    }
  });

  it('agrees on words with repeated letters, which is where the two differ most', () => {
    const doubled = compileLexicon({
      guesses: ['speed', 'erase', 'geese', 'sheep', 'three', 'abbey', 'level', 'daddy'],
      answers: ['speed', 'erase', 'geese', 'sheep', 'three', 'abbey', 'level', 'daddy'],
    });
    const columns = Int32Array.from({ length: doubled.answerCount }, (_, i) => i);
    const doubledMatrix = buildPatternMatrix(doubled, columns);

    for (let guess = 0; guess < doubled.guessCount; guess += 1) {
      for (let column = 0; column < doubledMatrix.width; column += 1) {
        expect(doubledMatrix.patterns[guess * doubledMatrix.width + column]).toBe(
          computePattern(doubled.guessWords[guess]!, doubled.answerWords[column]!),
        );
      }
    }
  });

  it('only holds the candidates it was asked for', () => {
    // Spec §3: the working set is dictionary × current candidates, not
    // dictionary × all answers, which is what keeps the matrix off the client.
    const narrow = buildPatternMatrix(compiled, Int32Array.from([1, 4, 9]));

    expect(narrow.width).toBe(3);
    expect(narrow.patterns).toHaveLength(compiled.guessCount * 3);
    expect(narrow.columnOf[1]).toBe(0);
    expect(narrow.columnOf[4]).toBe(1);
    expect(narrow.columnOf[9]).toBe(2);
    expect(narrow.columnOf[0]).toBe(-1);
  });

  it('rejects columns that are not ascending and distinct', () => {
    // Ascending columns are what keep every derived candidate set canonical, so
    // this is a correctness precondition rather than tidiness.
    expect(() => buildPatternMatrix(compiled, Int32Array.from([4, 1]))).toThrow(RangeError);
    expect(() => buildPatternMatrix(compiled, Int32Array.from([1, 1]))).toThrow(RangeError);
    expect(() => buildPatternMatrix(compiled, new Int32Array(0))).toThrow(RangeError);
  });

  it('works on a six-word lexicon', () => {
    const tiny = compileLexicon(TWO_CANDIDATE_LEXICON);
    const tinyMatrix = buildPatternMatrix(
      tiny,
      Int32Array.from({ length: tiny.answerCount }, (_, i) => i),
    );

    expect(tinyMatrix.patterns).toHaveLength(6 * 3);
  });
});
