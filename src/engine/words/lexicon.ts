/**
 * The Lexicon port.
 *
 * The engine never imports `src/data`; it receives word lists as an injected
 * object (docs/architecture.md, enforced by the ESLint dependency rule). That
 * is what lets the engine tests run against twenty-word fixtures rather than
 * the whole dictionary, and it is why this file exists before the generated
 * lists do.
 *
 * **The order of `guesses` is part of the scorer's contract, not an incidental
 * detail.** Ties in the entropy ranking break by guess index, and the ranking
 * chooses which guesses the search explores, so reordering the dictionary can
 * legitimately move a score. Spec §5 covers this with the word-list version
 * stamp: a different list, or the same list in a different order, is a
 * different version. See docs/determinism.md.
 */

import { ALPHABET_SIZE, WORD_LENGTH, addLetterCounts, encodeWordInto, isEncodableWord } from './letters';

/** Word lists as the engine receives them. */
export interface Lexicon {
  /** Every word a player may type, in a fixed order. Spec §4: ~10k-13k+. */
  readonly guesses: readonly string[];
  /** The possible answers, a subset of `guesses`. Spec §4: ~3,000. */
  readonly answers: readonly string[];
}

/**
 * A lexicon with the flat arrays the search reads.
 *
 * Built once when a scoring run is constructed, then closed over, so the inner
 * loops stay monomorphic and no port dispatch happens per iteration.
 */
export interface CompiledLexicon {
  readonly guessCount: number;
  readonly answerCount: number;
  readonly guessWords: readonly string[];
  readonly answerWords: readonly string[];
  /** Letter codes of every guess: `WORD_LENGTH` per word, guess-index major. */
  readonly guessLetters: Uint8Array;
  /** Letter codes of every answer. */
  readonly answerLetters: Uint8Array;
  /** 26-slot letter multiset of every answer, answer-index major. */
  readonly answerLetterCounts: Uint8Array;
  /** Guess index of each answer, since answers are a subset of guesses. */
  readonly answerToGuess: Int32Array;
  /** Guess index of a word, or -1. */
  guessIndexOf(word: string): number;
  /** Answer index of a word, or -1. */
  answerIndexOf(word: string): number;
}

function requireDistinctWords(words: readonly string[], label: string): Map<string, number> {
  if (words.length === 0) {
    throw new RangeError(`The ${label} is empty.`);
  }
  const index = new Map<string, number>();
  for (let position = 0; position < words.length; position += 1) {
    const word = words[position]!;
    if (!isEncodableWord(word)) {
      throw new RangeError(
        `The ${label} holds ${JSON.stringify(word)}, which is not five lowercase letters a-z.`,
      );
    }
    if (index.has(word)) {
      throw new RangeError(`The ${label} holds ${JSON.stringify(word)} more than once.`);
    }
    index.set(word, position);
  }
  return index;
}

/**
 * Validate a lexicon and build the flat arrays.
 *
 * The two lookup maps are read by word at setup only. Nothing iterates them, so
 * no result depends on their insertion order.
 */
export function compileLexicon(lexicon: Lexicon): CompiledLexicon {
  const guessWords = [...lexicon.guesses];
  const answerWords = [...lexicon.answers];

  const guessIndex = requireDistinctWords(guessWords, 'guess dictionary');
  const answerIndex = requireDistinctWords(answerWords, 'answer list');

  const guessCount = guessWords.length;
  const answerCount = answerWords.length;

  const guessLetters = new Uint8Array(WORD_LENGTH * guessCount);
  for (let index = 0; index < guessCount; index += 1) {
    encodeWordInto(guessWords[index]!, guessLetters, WORD_LENGTH * index);
  }

  const answerLetters = new Uint8Array(WORD_LENGTH * answerCount);
  const answerLetterCounts = new Uint8Array(ALPHABET_SIZE * answerCount);
  const answerToGuess = new Int32Array(answerCount);

  for (let index = 0; index < answerCount; index += 1) {
    const word = answerWords[index]!;
    encodeWordInto(word, answerLetters, WORD_LENGTH * index);
    addLetterCounts(word, answerLetterCounts, ALPHABET_SIZE * index);

    const inDictionary = guessIndex.get(word);
    if (inDictionary === undefined) {
      // Spec §4 requires answer list ⊆ guess dictionary. Without it the search
      // could rank a candidate it is not allowed to play.
      throw new RangeError(
        `The answer ${JSON.stringify(word)} is not in the guess dictionary.`,
      );
    }
    answerToGuess[index] = inDictionary;
  }

  return {
    guessCount,
    answerCount,
    guessWords,
    answerWords,
    guessLetters,
    answerLetters,
    answerLetterCounts,
    answerToGuess,
    guessIndexOf: (word) => guessIndex.get(word) ?? -1,
    answerIndexOf: (word) => answerIndex.get(word) ?? -1,
  };
}
