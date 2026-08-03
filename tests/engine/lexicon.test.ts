import { describe, expect, it } from 'vitest';

import { ALPHABET_SIZE, WORD_LENGTH, decodeWord } from '../../src/engine/words/letters';
import { compileLexicon, type Lexicon } from '../../src/engine/words/lexicon';
import { FIXTURE_LEXICON, TWO_CANDIDATE_LEXICON } from '../support/lexicons';

/**
 * The Lexicon port is the seam that keeps the engine free of `src/data`. These
 * tests are the proof that it works: every one of them runs against a
 * hand-written fixture of a few dozen words, which is only possible because
 * nothing in the engine reaches for the generated lists.
 */

describe('compiling a lexicon', () => {
  const compiled = compileLexicon(FIXTURE_LEXICON);

  it('keeps both lists and their sizes', () => {
    expect(compiled.guessCount).toBe(FIXTURE_LEXICON.guesses.length);
    expect(compiled.answerCount).toBe(FIXTURE_LEXICON.answers.length);
    expect(compiled.guessWords).toEqual(FIXTURE_LEXICON.guesses);
    expect(compiled.answerWords).toEqual(FIXTURE_LEXICON.answers);
  });

  it('preserves the order of the guess dictionary, which the tie-break depends on', () => {
    // Ranking ties break by guess index, so the order of this list is part of
    // the scorer's contract rather than an incidental detail. See
    // docs/determinism.md.
    for (let index = 0; index < compiled.guessCount; index += 1) {
      expect(compiled.guessIndexOf(FIXTURE_LEXICON.guesses[index]!)).toBe(index);
    }
  });

  it('packs the letters of every word', () => {
    for (let index = 0; index < compiled.guessCount; index += 1) {
      expect(decodeWord(compiled.guessLetters, WORD_LENGTH * index)).toBe(
        compiled.guessWords[index],
      );
    }
    for (let index = 0; index < compiled.answerCount; index += 1) {
      expect(decodeWord(compiled.answerLetters, WORD_LENGTH * index)).toBe(
        compiled.answerWords[index],
      );
    }
  });

  it('packs the letter multiset of every answer', () => {
    for (let index = 0; index < compiled.answerCount; index += 1) {
      const word = compiled.answerWords[index]!;
      for (let letter = 0; letter < ALPHABET_SIZE; letter += 1) {
        const expected = [...word].filter(
          (character) => character.charCodeAt(0) - 97 === letter,
        ).length;
        expect(compiled.answerLetterCounts[ALPHABET_SIZE * index + letter]).toBe(expected);
      }
    }
  });

  it('maps every answer to its place in the dictionary', () => {
    for (let index = 0; index < compiled.answerCount; index += 1) {
      const guessIndex = compiled.answerToGuess[index]!;
      expect(compiled.guessWords[guessIndex]).toBe(compiled.answerWords[index]);
    }
  });

  it('reports -1 for a word it does not hold', () => {
    expect(compiled.guessIndexOf('zzzzz')).toBe(-1);
    expect(compiled.answerIndexOf('adieu')).toBe(-1);
    expect(compiled.guessIndexOf('adieu')).toBeGreaterThanOrEqual(0);
  });

  it('accepts a lexicon of six words, which is the point of the port', () => {
    const tiny = compileLexicon(TWO_CANDIDATE_LEXICON);

    expect(tiny.guessCount).toBe(6);
    expect(tiny.answerCount).toBe(3);
  });
});

describe('rejecting a malformed lexicon', () => {
  function compiling(lexicon: Lexicon): () => unknown {
    return () => compileLexicon(lexicon);
  }

  it('rejects an answer that is not in the guess dictionary', () => {
    // Spec §4 requires answer list ⊆ guess dictionary. Without it the search
    // could rank a candidate the player is not allowed to type.
    expect(
      compiling({ guesses: ['crane'], answers: ['crane', 'slate'] }),
    ).toThrow(/not in the guess dictionary/);
  });

  it('rejects a repeated word', () => {
    expect(compiling({ guesses: ['crane', 'crane'], answers: ['crane'] })).toThrow(
      /more than once/,
    );
    expect(compiling({ guesses: ['crane'], answers: ['crane', 'crane'] })).toThrow(
      /more than once/,
    );
  });

  it('rejects a word that is not five lowercase letters', () => {
    expect(compiling({ guesses: ['CRANE'], answers: ['CRANE'] })).toThrow(
      /five lowercase letters/,
    );
    expect(compiling({ guesses: ['cranes'], answers: ['cranes'] })).toThrow(
      /five lowercase letters/,
    );
  });

  it('rejects an empty list', () => {
    expect(compiling({ guesses: [], answers: [] })).toThrow(/empty/);
    expect(compiling({ guesses: ['crane'], answers: [] })).toThrow(/empty/);
  });
});
