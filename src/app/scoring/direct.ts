/**
 * A ScoringClient that scores on the calling thread.
 *
 * Used by tests and by any environment without workers. It shares no code path
 * with the worker beyond the engine itself, which is the point: a test that
 * compares the two is comparing the transport, not the arithmetic.
 */

import { answers, answersV2, answersV2Weights, guesses } from '../../data';
import { CUTOVER_PUZZLE_NUMBER, parFor } from '../../engine/config/constants';
import { rulesetFor } from '../../engine/rules/ruleset';
import { scoreGame } from '../../engine/score/scoreGame';
import { createPositionScorer } from '../../engine/score/scoreGuess';
import { validatedPolicy } from '../../engine/search/policy';
import { compileLexicon, type CompiledLexicon } from '../../engine/words/lexicon';
import { withCache, type ScoreQuery, type ScoringClient } from './client';
import type { GameScore } from './protocol';

let legacyLexicon: CompiledLexicon | undefined;
let v2Lexicon: CompiledLexicon | undefined;

function lexiconFor(puzzleNumber?: number): CompiledLexicon {
  if (puzzleNumber !== undefined && puzzleNumber >= CUTOVER_PUZZLE_NUMBER) {
    v2Lexicon ??= compileLexicon({
      guesses,
      answers: answersV2,
      answerWeights: answersV2Weights,
    });
    return v2Lexicon;
  }
  legacyLexicon ??= compileLexicon({ guesses, answers });
  return legacyLexicon;
}

export function scoreDirectly(query: ScoreQuery): GameScore {
  return scoreGame(
    {
      guesses: query.guesses,
      answer: query.answer,
      tookHouseStarter: query.tookHouseStarter,
      par: parFor(query.puzzleNumber),
    },
    createPositionScorer({
      lexicon: lexiconFor(query.puzzleNumber),
      ruleset: rulesetFor(query.hardMode ? 'hard' : 'normal'),
      policy: validatedPolicy,
    }),
  );
}

export function createDirectScoringClient(): ScoringClient {
  return withCache(async (query) => scoreDirectly(query));
}
