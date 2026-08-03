/**
 * Word encoding — the representation every other part of the engine reads.
 *
 * A word is exactly five lowercase letters (spec §4: "all lists lowercase, five
 * letters, no duplicates"), so a word encodes to five letter codes in 0..25.
 * The hot paths of the search read letters out of flat `Uint8Array`s rather
 * than out of strings, which is why the encoding lives on its own rather than
 * inside the pattern computation.
 *
 * Reads out of a typed array widen to `number | undefined` under
 * `noUncheckedIndexedAccess`. Where an index has already been bounded by the
 * surrounding loop, the assertion records that rather than re-checking it.
 */

export const WORD_LENGTH = 5;
export const ALPHABET_SIZE = 26;

const CODE_A = 97;

/** Letter code in 0..25, or -1 if the character is not a lowercase a-z. */
function letterCodeOf(word: string, index: number): number {
  const code = word.charCodeAt(index) - CODE_A;
  // A read past the end gives NaN, which fails both comparisons.
  return code >= 0 && code < ALPHABET_SIZE ? code : -1;
}

/** Whether `value` is five lowercase letters and so can be encoded. */
export function isEncodableWord(value: string): boolean {
  if (value.length !== WORD_LENGTH) {
    return false;
  }
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (letterCodeOf(value, index) < 0) {
      return false;
    }
  }
  return true;
}

function requireEncodable(word: string): void {
  if (!isEncodableWord(word)) {
    throw new RangeError(`Not five lowercase letters a-z: ${JSON.stringify(word)}`);
  }
}

/** Write the five letter codes of `word` into `into` at `offset`. */
export function encodeWordInto(word: string, into: Uint8Array, offset = 0): void {
  requireEncodable(word);
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    into[offset + index] = letterCodeOf(word, index);
  }
}

/** The five letter codes of `word`. */
export function encodeWord(word: string): Uint8Array {
  const codes = new Uint8Array(WORD_LENGTH);
  encodeWordInto(word, codes, 0);
  return codes;
}

/** The word held by five letter codes starting at `offset`. */
export function decodeWord(codes: ArrayLike<number>, offset = 0): string {
  let word = '';
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    word += String.fromCharCode(CODE_A + (codes[offset + index] ?? 0));
  }
  return word;
}

/**
 * Add the letter multiset of `word` into a 26-slot count table at `offset`.
 * The table is not cleared first, so a caller reusing scratch must clear it.
 */
export function addLetterCounts(word: string, into: Uint8Array, offset = 0): void {
  requireEncodable(word);
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    const slot = offset + letterCodeOf(word, index);
    into[slot] = (into[slot] ?? 0) + 1;
  }
}
