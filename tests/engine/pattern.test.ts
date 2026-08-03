import { describe, expect, it } from 'vitest';

import { WORD_LENGTH } from '../../src/engine/words/letters';
import {
  PATTERN_COUNT,
  PATTERN_PLACE_VALUES,
  Tile,
  WIN_PATTERN,
  computePattern,
  isWinPattern,
  patternFromTiles,
  tilesFromPattern,
} from '../../src/engine/words/pattern';
import { FIXTURE_LEXICON } from '../support/lexicons';

/**
 * Spec §10 fixes six feedback cases as verified, and says the implementation
 * must match all six. They are written here in the spec's own emoji so a
 * reviewer can compare the table without decoding anything, and in the spec's
 * own uppercase — the engine works in lowercase, which is the only translation
 * these tests perform.
 */

const TILE_BY_GLYPH: Record<string, Tile> = {
  '⬜': Tile.Absent,
  '🟨': Tile.Present,
  '🟩': Tile.Correct,
};

function patternOfGlyphs(glyphs: string): number {
  const tiles = [...glyphs].map((glyph) => {
    const tile = TILE_BY_GLYPH[glyph];
    if (tile === undefined) {
      throw new Error(`Not a feedback tile: ${glyph}`);
    }
    return tile;
  });
  return patternFromTiles(tiles);
}

const SPEC_VECTORS = [
  { guess: 'SPEED', answer: 'ABIDE', result: '⬜⬜🟨⬜🟨' },
  { guess: 'SPEED', answer: 'ERASE', result: '🟨⬜🟨🟨⬜' },
  { guess: 'CRANE', answer: 'CRANE', result: '🟩🟩🟩🟩🟩' },
  { guess: 'AAAAA', answer: 'ABOUT', result: '🟩⬜⬜⬜⬜' },
  { guess: 'BANAL', answer: 'ANNAL', result: '⬜🟨🟩🟩🟩' },
  { guess: 'ANNAL', answer: 'BANAL', result: '🟨⬜🟩🟩🟩' },
] as const;

function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of word) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

describe('the six verified feedback vectors', () => {
  it.each(SPEC_VECTORS)('$guess against $answer gives $result', (vector) => {
    expect(computePattern(vector.guess.toLowerCase(), vector.answer.toLowerCase())).toBe(
      patternOfGlyphs(vector.result),
    );
  });

  it('reads the emoji tables the same way the spec writes them', () => {
    // A guard on the translation itself: if this mapping were wrong, all six
    // cases above could agree with each other and still be wrong.
    expect(tilesFromPattern(patternOfGlyphs('⬜🟨🟩🟩🟩'))).toEqual([
      Tile.Absent,
      Tile.Present,
      Tile.Correct,
      Tile.Correct,
      Tile.Correct,
    ]);
  });
});

describe('the pattern encoding', () => {
  it('packs five base-three digits with position 0 most significant', () => {
    expect(PATTERN_PLACE_VALUES).toEqual([81, 27, 9, 3, 1]);
    expect(PATTERN_COUNT).toBe(243);
  });

  it('reserves 242 for the all-green win', () => {
    expect(WIN_PATTERN).toBe(242);
    expect(isWinPattern(patternOfGlyphs('🟩🟩🟩🟩🟩'))).toBe(true);
    expect(isWinPattern(241)).toBe(false);
  });

  it('round-trips every pattern through its tiles', () => {
    for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
      const tiles = tilesFromPattern(pattern);
      expect(tiles).toHaveLength(WORD_LENGTH);
      expect(patternFromTiles(tiles)).toBe(pattern);
    }
  });

  it('rejects a pattern outside 0..242', () => {
    expect(() => tilesFromPattern(243)).toThrow(RangeError);
    expect(() => tilesFromPattern(-1)).toThrow(RangeError);
    expect(() => tilesFromPattern(1.5)).toThrow(RangeError);
  });

  it('rejects tiles that are not five long', () => {
    expect(() => patternFromTiles([Tile.Absent])).toThrow(RangeError);
  });
});

describe('feedback against every fixture pair', () => {
  const pairs = FIXTURE_LEXICON.guesses.flatMap((guess) =>
    FIXTURE_LEXICON.answers.map((answer) => ({ guess, answer })),
  );

  it('only ever wins when the guess is the answer', () => {
    for (const { guess, answer } of pairs) {
      expect(isWinPattern(computePattern(guess, answer))).toBe(guess === answer);
    }
  });

  it('greens sit exactly where the letters agree', () => {
    for (const { guess, answer } of pairs) {
      const tiles = tilesFromPattern(computePattern(guess, answer));
      for (let position = 0; position < WORD_LENGTH; position += 1) {
        expect(tiles[position] === Tile.Correct).toBe(guess[position] === answer[position]);
      }
    }
  });

  it('marks each letter non-grey exactly as often as both words hold it', () => {
    // This is what correct duplicate handling *means*: of the guess's copies of
    // a letter, min(in guess, in answer) come back green or yellow. Spec §10's
    // SPEED/ERASE and BANAL/ANNAL cases are instances of it; asserting the rule
    // over every pair catches the cases the table does not name.
    for (const { guess, answer } of pairs) {
      const tiles = tilesFromPattern(computePattern(guess, answer));
      const inGuess = letterCounts(guess);
      const inAnswer = letterCounts(answer);

      for (const [letter, guessCount] of inGuess) {
        let marked = 0;
        for (let position = 0; position < WORD_LENGTH; position += 1) {
          if (guess[position] === letter && tiles[position] !== Tile.Absent) {
            marked += 1;
          }
        }
        expect(marked).toBe(Math.min(guessCount, inAnswer.get(letter) ?? 0));
      }
    }
  });
});
