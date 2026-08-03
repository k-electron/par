/**
 * Spec §4's required properties, re-asserted against the committed lists.
 *
 * The generator asserts these too, but the generator does not run in CI and
 * needs Python. These tests are what stop a hand-edited or half-regenerated
 * list from reaching the browser.
 */

import { describe, expect, it } from 'vitest';

import { WORD_LIST_VERSION, answers, guesses, starters } from '../../src/data';

const FIVE_LOWERCASE = /^[a-z]{5}$/;

type Shape = 'distinct' | 'one-pair' | 'excluded';

function letterShape(word: string): Shape {
  const counts = new Map<string, number>();
  for (const letter of word) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  const tallies = [...counts.values()];
  if (tallies.some((count) => count >= 3)) return 'excluded';
  const pairs = tallies.filter((count) => count === 2).length;
  if (pairs === 0) return 'distinct';
  if (pairs === 1) return 'one-pair';
  return 'excluded';
}

const lists = [
  ['guess dictionary', guesses],
  ['answer list', answers],
  ['starter pool', starters],
] as const;

describe.each(lists)('%s', (label, words) => {
  it('is lowercase five-letter words', () => {
    const offenders = words.filter((word) => !FIVE_LOWERCASE.test(word));
    expect(offenders, `${label} has malformed entries`).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it('is not empty', () => {
    expect(words.length).toBeGreaterThan(0);
  });
});

describe('sizes', () => {
  // Spec §4: guess dictionary ~10k-13k+, answers ~3,000, starters ~5,000-6,000.
  it('keeps the guess dictionary inside the stated range', () => {
    expect(guesses.length).toBeGreaterThanOrEqual(10_000);
  });

  it('keeps the answer list near three thousand', () => {
    expect(answers.length).toBeGreaterThanOrEqual(2_800);
    expect(answers.length).toBeLessThanOrEqual(3_200);
  });

  it('keeps the starter pool inside the stated range', () => {
    expect(starters.length).toBeGreaterThanOrEqual(5_000);
    expect(starters.length).toBeLessThanOrEqual(6_000);
  });
});

describe('subset relationships', () => {
  const dictionary = new Set(guesses);

  it('draws every answer from the guess dictionary', () => {
    // Without this the search could rank a candidate nobody is allowed to play.
    expect(answers.filter((word) => !dictionary.has(word))).toEqual([]);
  });

  it('draws every starter from the guess dictionary', () => {
    expect(starters.filter((word) => !dictionary.has(word))).toEqual([]);
  });
});

describe('starter pool composition', () => {
  it('excludes two pairs and any letter appearing three or more times', () => {
    expect(starters.filter((word) => letterShape(word) === 'excluded')).toEqual([]);
  });

  it('is about ninety per cent five-distinct-letter words', () => {
    const distinct = starters.filter((word) => letterShape(word) === 'distinct').length;
    // Spec §4 asks for the split "within a percentage point or so".
    expect(distinct / starters.length).toBeGreaterThanOrEqual(0.89);
    expect(distinct / starters.length).toBeLessThanOrEqual(0.91);
  });

  it('is about ten per cent one-doubled-letter words', () => {
    const onePair = starters.filter((word) => letterShape(word) === 'one-pair').length;
    expect(onePair / starters.length).toBeGreaterThanOrEqual(0.09);
    expect(onePair / starters.length).toBeLessThanOrEqual(0.11);
  });
});

describe('version identifier', () => {
  it('is a stable short hex digest', () => {
    expect(WORD_LIST_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is what the current lists actually hash to', async () => {
    // Mirrors compute_version() in tools/wordlists/build.py. If this fails, the
    // committed lists and the committed version have drifted apart, which would
    // let a share link claim a list version it was not built against (spec §5).
    const { createHash } = await import('node:crypto');
    const digest = createHash('sha256');
    for (const [name, words] of [
      ['answers', answers],
      ['guesses', guesses],
      ['starters', starters],
    ] as const) {
      digest.update(name, 'utf8');
      digest.update('\n', 'utf8');
      digest.update(words.join('\n'), 'utf8');
      digest.update('\n', 'utf8');
    }
    expect(WORD_LIST_VERSION).toBe(digest.digest('hex').slice(0, 12));
  });
});
