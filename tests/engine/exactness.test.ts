import { describe, expect, it } from 'vitest';

import { hardRuleset, normalRuleset, type Ruleset } from '../../src/engine/rules/ruleset';
import { createPositionScorer, type GuessScore } from '../../src/engine/score/scoreGuess';
import {
  bruteForcePolicy,
  validatedPolicy,
  widePolicy,
  type SearchPolicy,
} from '../../src/engine/search/policy';
import { compileLexicon } from '../../src/engine/words/lexicon';
import { computePattern, isWinPattern } from '../../src/engine/words/pattern';
import { float64Bits } from '../support/bits';
import { FIXTURE_LEXICON } from '../support/lexicons';
import { observationsFor, permuted } from '../support/positions';

/**
 * The two claims spec §3 and §5 make that no single position can demonstrate.
 *
 * **Exactness.** The validated ladder is an approximation, so it has to be shown
 * to cost nothing. Decision 0001 removed the separate reference implementation
 * from scope precisely because the brute-force policy already is one: it searches
 * every legal guess at every depth, which is the definition of `V` with no
 * approximation in it. Agreement between the two is the evidence.
 *
 * **Bit-identical results.** Not merely equal — identical bit patterns, because a
 * value that differs in the last bit will eventually rank two guesses the other
 * way round and move a score discontinuously.
 */

const compiled = compileLexicon(FIXTURE_LEXICON);

function scorerFor(ruleset: Ruleset, policy: SearchPolicy) {
  return createPositionScorer({ lexicon: compiled, ruleset, policy });
}

/** Positions a game actually reaches: a plausible opener, then the field it leaves. */
const POSITIONS = [
  { answer: 'watch', played: ['slate'] },
  { answer: 'right', played: ['slate'] },
  { answer: 'sound', played: ['crane'] },
  { answer: 'thumb', played: ['adieu'] },
  { answer: 'taste', played: ['crane'] },
  { answer: 'found', played: ['slate', 'bongo'] },
] as const;

const GUESSES = ['batch', 'right', 'sound', 'crane', 'bongo', 'thumb', 'watch'] as const;

interface Sample {
  readonly label: string;
  readonly score: GuessScore;
}

function sampleAll(ruleset: Ruleset, policy: SearchPolicy): Sample[] {
  const samples: Sample[] = [];

  for (const { answer, played } of POSITIONS) {
    if (played.some((guess) => isWinPattern(computePattern(guess, answer)))) {
      continue;
    }
    const history = observationsFor(answer, played);
    const scorer = scorerFor(ruleset, policy);

    for (const guess of GUESSES) {
      let score: GuessScore;
      try {
        score = scorer.scoreGuess(history, guess);
      } catch {
        // Illegal in hard mode from here, which is not a disagreement.
        continue;
      }
      samples.push({ label: `${ruleset.mode} ${answer}/${played.join(',')}/${guess}`, score });
    }
  }

  return samples;
}

describe('the validated ladder against brute force', () => {
  it.each([normalRuleset, hardRuleset])(
    'gives identical scores in $mode mode',
    (ruleset) => {
      // If this ever fails, the cheap ladder is losing precision somewhere a
      // player could see, and spec §3's "exact where precision is visible" is no
      // longer true.
      const reference = sampleAll(ruleset, bruteForcePolicy);
      const validated = sampleAll(ruleset, validatedPolicy);

      // Guards against the comparison quietly becoming vacuous. Hard mode has
      // fewer samples than normal because several of these guesses are illegal
      // from these positions, which is asserted below rather than assumed.
      expect(validated.length).toBe(reference.length);
      expect(reference.length).toBeGreaterThan(10);

      for (let index = 0; index < reference.length; index += 1) {
        const expected = reference[index]!;
        const actual = validated[index]!;

        expect(actual.label).toBe(expected.label);
        expect(float64Bits(actual.score.skill), expected.label).toBe(
          float64Bits(expected.score.skill),
        );
        expect(actual.score.forced, expected.label).toBe(expected.score.forced);
      }
    },
  );

  it('really is comparing hard mode against a narrower legal set', () => {
    // Otherwise the hard-mode agreement above could be passing because hard mode
    // was never restricting anything.
    expect(sampleAll(hardRuleset, bruteForcePolicy).length).toBeLessThan(
      sampleAll(normalRuleset, bruteForcePolicy).length,
    );
  });

  it('gives identical scores under the wide ladder too', () => {
    // Three policies with different branching agreeing to the bit is much
    // stronger evidence than two: a shared bug would have to survive being given
    // a different set of guesses to look at.
    const reference = sampleAll(normalRuleset, bruteForcePolicy);
    const wide = sampleAll(normalRuleset, widePolicy);

    for (let index = 0; index < reference.length; index += 1) {
      expect(float64Bits(wide[index]!.score.skill), reference[index]!.label).toBe(
        float64Bits(reference[index]!.score.skill),
      );
    }
  });
});

describe('every score is a score', () => {
  it('lands in (0, 100] on every sampled position, in both modes', () => {
    // Spec §3. Zero would mean a guess with no value at all, and above 100 would
    // mean the player beat a benchmark that is supposed to be optimal.
    for (const ruleset of [normalRuleset, hardRuleset]) {
      for (const { label, score } of sampleAll(ruleset, validatedPolicy)) {
        expect(score.skill, label).toBeGreaterThan(0);
        expect(score.skill, label).toBeLessThanOrEqual(100);
        expect(Number.isFinite(score.skill), label).toBe(true);
      }
    }
  });

  it('reaches 100 somewhere in every position, in both modes', () => {
    // "100 is achievable at every step in both modes." This is the guarantee that
    // hard mode never holds a player to a standard the rules forbid: the
    // benchmark is the best *legal* guess, so some legal guess always attains it.
    for (const ruleset of [normalRuleset, hardRuleset]) {
      for (const { answer, played } of POSITIONS) {
        if (played.some((guess) => isWinPattern(computePattern(guess, answer)))) {
          continue;
        }
        const history = observationsFor(answer, played);
        const scorer = scorerFor(ruleset, validatedPolicy);
        let best = 0;

        for (const guess of FIXTURE_LEXICON.guesses) {
          try {
            best = Math.max(best, scorer.scoreGuess(history, guess).skill);
          } catch {
            continue;
          }
        }

        expect(best, `${ruleset.mode} ${answer}/${played.join(',')}`).toBe(100);
      }
    }
  });
});

describe('bit-identical results', () => {
  const history = observationsFor('watch', ['slate']);

  function skillBits(scorer: ReturnType<typeof scorerFor>, order: readonly string[]) {
    const bits = new Map<string, string>();
    for (const guess of order) {
      bits.set(guess, float64Bits(scorer.scoreGuess(history, guess).skill));
    }
    return bits;
  }

  const baseline = skillBits(scorerFor(normalRuleset, validatedPolicy), GUESSES);

  it('repeats exactly on a fresh scorer', () => {
    expect(skillBits(scorerFor(normalRuleset, validatedPolicy), GUESSES)).toEqual(baseline);
  });

  it('repeats exactly on a scorer whose memo is already warm', () => {
    // The memo is the one piece of mutable state in the search, so a stale or
    // mis-keyed entry would show up here as a second answer to the same question.
    const scorer = scorerFor(normalRuleset, validatedPolicy);

    expect(skillBits(scorer, GUESSES)).toEqual(baseline);
    expect(skillBits(scorer, GUESSES)).toEqual(baseline);
  });

  it('does not depend on the order the guesses are scored in', () => {
    const scorer = scorerFor(normalRuleset, validatedPolicy);

    expect(skillBits(scorer, [...GUESSES].reverse())).toEqual(baseline);
    expect(skillBits(scorer, permuted(GUESSES))).toEqual(baseline);
  });

  it('does not depend on the order the history arrived in', () => {
    // Consistency and constraint accumulation are both order-free, so a reordered
    // history is the same position and has to produce the same bits.
    const twoDeep = observationsFor('found', ['slate', 'bongo']);
    const forwards = scorerFor(normalRuleset, validatedPolicy);
    const shuffled = scorerFor(normalRuleset, validatedPolicy);

    for (const guess of GUESSES) {
      expect(float64Bits(shuffled.scoreGuess(permuted(twoDeep), guess).skill), guess).toBe(
        float64Bits(forwards.scoreGuess(twoDeep, guess).skill),
      );
    }
  });

  it('does not depend on the order the answer list was written in', () => {
    // The candidate set is canonicalised to ascending answer indices, so a
    // differently ordered word list is a different lexicon but the same position.
    const reordered = compileLexicon({
      guesses: FIXTURE_LEXICON.guesses,
      answers: permuted(FIXTURE_LEXICON.answers),
    });
    const scorer = createPositionScorer({
      lexicon: reordered,
      ruleset: normalRuleset,
      policy: validatedPolicy,
    });

    for (const guess of GUESSES) {
      expect(float64Bits(scorer.scoreGuess(history, guess).skill), guess).toBe(
        baseline.get(guess),
      );
    }
  });
});
