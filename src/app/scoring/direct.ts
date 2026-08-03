/**
 * A ScoringClient that scores on the calling thread.
 *
 * Used by tests and by any environment without workers. It shares no code path
 * with the worker beyond the engine itself, which is the point: a test that
 * compares the two is comparing the transport, not the arithmetic.
 */

import { answers, guesses } from '../../data';
import { rulesetFor } from '../../engine/rules/ruleset';
import { scoreGame } from '../../engine/score/scoreGame';
import { createPositionScorer } from '../../engine/score/scoreGuess';
import { validatedPolicy } from '../../engine/search/policy';
import { compileLexicon, type CompiledLexicon } from '../../engine/words/lexicon';
import type { ScoreQuery, ScoringClient } from './client';
import type { GameScore } from './protocol';

let lexicon: CompiledLexicon | undefined;

export function scoreDirectly(query: ScoreQuery): GameScore {
  lexicon ??= compileLexicon({ guesses, answers });
  return scoreGame(
    {
      guesses: query.guesses,
      answer: query.answer,
      tookHouseStarter: query.tookHouseStarter,
    },
    createPositionScorer({
      lexicon,
      ruleset: rulesetFor(query.hardMode ? 'hard' : 'normal'),
      policy: validatedPolicy,
    }),
  );
}

export function createDirectScoringClient(): ScoringClient {
  const cache = new Map<string, GameScore>();

  return {
    async score(query) {
      const key = [
        query.hardMode ? 'h' : 'n',
        query.tookHouseStarter ? 's' : 'o',
        query.answer,
        ...query.guesses,
      ].join('|');

      let score = cache.get(key);
      if (score === undefined) {
        score = scoreDirectly(query);
        cache.set(key, score);
      }
      return score;
    },
    dispose() {
      cache.clear();
    },
  };
}
