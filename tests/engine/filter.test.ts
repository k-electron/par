import { describe, expect, it } from 'vitest';

import {
  filterByHistory,
  filterCandidates,
  isConsistent,
  patternCounts,
} from '../../src/engine/words/filter';
import { PATTERN_COUNT, computePattern } from '../../src/engine/words/pattern';
import { FIXTURE_LEXICON, TWO_CANDIDATE_LEXICON } from '../support/lexicons';
import { candidatesAfter, observationsFor, permuted } from '../support/positions';

/**
 * Spec §3: `S_i` is the set of answer-list words consistent with all feedback
 * before guess *i*. Two things are being pinned down here — that "consistent"
 * means exactly "replaying the guess reproduces the pattern", and that the set
 * is drawn from the answer list rather than the dictionary.
 */

describe('filtering by one observation', () => {
  it('keeps a word exactly when replaying the guess reproduces the pattern', () => {
    for (const guess of FIXTURE_LEXICON.guesses) {
      for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
        const kept = filterCandidates(FIXTURE_LEXICON.answers, guess, pattern);
        const expected = FIXTURE_LEXICON.answers.filter(
          (answer) => computePattern(guess, answer) === pattern,
        );
        expect(kept).toEqual(expected);
      }
    }
  });

  it('partitions the answer list, losing and duplicating nothing', () => {
    for (const guess of FIXTURE_LEXICON.guesses) {
      let total = 0;
      for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
        total += filterCandidates(FIXTURE_LEXICON.answers, guess, pattern).length;
      }
      expect(total).toBe(FIXTURE_LEXICON.answers.length);
    }
  });

  it('always keeps the answer that produced the feedback', () => {
    for (const answer of FIXTURE_LEXICON.answers) {
      for (const guess of FIXTURE_LEXICON.guesses) {
        const pattern = computePattern(guess, answer);
        expect(filterCandidates(FIXTURE_LEXICON.answers, guess, pattern)).toContain(answer);
        expect(isConsistent(answer, { guess, pattern })).toBe(true);
      }
    }
  });

  it('preserves the order of the list it was given', () => {
    const forwards = filterCandidates(FIXTURE_LEXICON.answers, 'match', 80);
    const backwards = filterCandidates([...FIXTURE_LEXICON.answers].reverse(), 'match', 80);

    expect(forwards.length).toBeGreaterThan(1);
    expect(backwards).toEqual([...forwards].reverse());
  });
});

describe('counting a partition', () => {
  it('agrees with filtering, slot for slot', () => {
    for (const guess of FIXTURE_LEXICON.guesses) {
      const counts = patternCounts(guess, FIXTURE_LEXICON.answers);
      for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
        expect(counts[pattern]).toBe(
          filterCandidates(FIXTURE_LEXICON.answers, guess, pattern).length,
        );
      }
    }
  });

  it('returns a dense table so it is read in pattern order on every machine', () => {
    const counts = patternCounts('crane', FIXTURE_LEXICON.answers);
    expect(counts).toHaveLength(PATTERN_COUNT);
  });
});

describe('filtering by a history', () => {
  const history = observationsFor('watch', ['slate', 'batch']);

  it('applies every observation', () => {
    const live = filterByHistory(FIXTURE_LEXICON.answers, history);

    expect(live).toContain('watch');
    for (const candidate of live) {
      for (const observation of history) {
        expect(isConsistent(candidate, observation)).toBe(true);
      }
    }
  });

  it('does not depend on the order the observations are applied in', () => {
    // Consistency is a conjunction of independent tests, so a reordered history
    // must not move the candidate set — and therefore cannot move a score.
    expect(filterByHistory(FIXTURE_LEXICON.answers, permuted(history))).toEqual(
      filterByHistory(FIXTURE_LEXICON.answers, history),
    );
  });

  it('leaves the whole answer list when nothing has been played', () => {
    expect(filterByHistory(FIXTURE_LEXICON.answers, [])).toEqual([
      ...FIXTURE_LEXICON.answers,
    ]);
  });

  it('draws candidates from the answer list, never from the dictionary', () => {
    // docs/philosophy.md, "Why the benchmark uses the answer list": treating an
    // obscure non-answer word as a live possibility would punish a player for
    // correctly sensing the answer will be a common word.
    const dictionaryOnly = FIXTURE_LEXICON.guesses.filter(
      (word) => !FIXTURE_LEXICON.answers.includes(word),
    );
    expect(dictionaryOnly).toContain('haste');

    const live = filterByHistory(FIXTURE_LEXICON.answers, observationsFor('taste', ['crane']));
    expect(live).toContain('taste');
    for (const word of dictionaryOnly) {
      expect(live).not.toContain(word);
    }
  });
});

describe('the two-candidate fixture', () => {
  it('leaves exactly batch and catch after match is played against catch', () => {
    // Spec §10's sharpest scorer check needs a position with exactly two
    // candidates, so the fixture that produces it is asserted here rather than
    // assumed by the scorer tests.
    const history = observationsFor('catch', ['match']);

    expect(candidatesAfter(TWO_CANDIDATE_LEXICON, history)).toEqual(['batch', 'catch']);
  });

  it('has a probe that separates them and a probe that separates nothing', () => {
    expect(computePattern('bongo', 'batch')).not.toBe(computePattern('bongo', 'catch'));
    expect(computePattern('haste', 'batch')).toBe(computePattern('haste', 'catch'));
  });
});
