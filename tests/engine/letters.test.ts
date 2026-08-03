import { describe, expect, it } from 'vitest';

import {
  ALPHABET_SIZE,
  WORD_LENGTH,
  addLetterCounts,
  decodeWord,
  encodeWord,
  encodeWordInto,
  isEncodableWord,
} from '../../src/engine/words/letters';

describe('word encoding', () => {
  it('turns a word into five letter codes and back', () => {
    expect([...encodeWord('crane')]).toEqual([2, 17, 0, 13, 4]);
    expect(decodeWord(encodeWord('crane'))).toBe('crane');
  });

  it('writes into a shared buffer at an offset, which is how the lexicon packs', () => {
    const buffer = new Uint8Array(WORD_LENGTH * 2);
    encodeWordInto('abcde', buffer, 0);
    encodeWordInto('zzzzz', buffer, WORD_LENGTH);

    expect(decodeWord(buffer, 0)).toBe('abcde');
    expect(decodeWord(buffer, WORD_LENGTH)).toBe('zzzzz');
  });

  it('counts a letter multiset, duplicates included', () => {
    const counts = new Uint8Array(ALPHABET_SIZE);
    addLetterCounts('speed', counts);

    expect(counts[4]).toBe(2);
    expect(counts[18]).toBe(1);
    expect(counts[25]).toBe(0);
  });

  it.each([
    ['crane', true],
    ['CRANE', false],
    ['cran', false],
    ['cranes', false],
    ['', false],
    ['cran3', false],
    ['cran ', false],
    ['crané', false],
  ])('treats %s as encodable: %s', (value, encodable) => {
    expect(isEncodableWord(value)).toBe(encodable);
  });

  it('refuses to encode anything that is not five lowercase letters', () => {
    expect(() => encodeWord('CRANE')).toThrow(RangeError);
    expect(() => encodeWord('cran')).toThrow(RangeError);
  });
});
