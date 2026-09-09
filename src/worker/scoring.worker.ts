/**
 * Scoring, off the main thread.
 *
 * Spec §9: scoring must not block or freeze the interface. A full game's score
 * is tens of milliseconds of tight numeric work over a few hundred candidates,
 * which is fast but not free, and doing it inline would drop frames exactly as
 * the results view animates in.
 *
 * The worker owns the compiled lexicon, which is the expensive thing to build,
 * so it is built once on first use and reused for every later request. Two
 * rulesets mean two scorers; both are cached for the same reason.
 */

import { answers, answersV2, answersV2Weights, guesses } from '../data';
import { parFor } from '../engine/config/constants';
import { CUTOVER_PUZZLE_NUMBER } from '../engine/daily/puzzle';
import { rulesetFor } from '../engine/rules/ruleset';
import { scoreGame } from '../engine/score/scoreGame';
import { createPositionScorer, type PositionScorer } from '../engine/score/scoreGuess';
import { validatedPolicy } from '../engine/search/policy';
import { compileLexicon, type CompiledLexicon } from '../engine/words/lexicon';
import type { ScoreRequest, ScoreResponse } from '../app/scoring/protocol';

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

/**
 * A fresh scorer per request.
 *
 * Deliberate: the scorer caches a pattern matrix keyed to one game's candidate
 * set, and reusing it across games would either rebuild constantly or hold a
 * matrix for the wrong position. The lexicon underneath is what is worth
 * keeping, and it is.
 */
function scorerFor(hardMode: boolean, puzzleNumber?: number): PositionScorer {
  return createPositionScorer({
    lexicon: lexiconFor(puzzleNumber),
    ruleset: rulesetFor(hardMode ? 'hard' : 'normal'),
    policy: validatedPolicy,
  });
}

self.addEventListener('message', (event: MessageEvent<ScoreRequest>) => {
  const request = event.data;

  let response: ScoreResponse;
  try {
    response = {
      id: request.id,
      ok: true,
      score: scoreGame(
        {
          guesses: request.guesses,
          answer: request.answer,
          tookHouseStarter: request.tookHouseStarter,
          par: parFor(request.puzzleNumber),
        },
        scorerFor(request.hardMode, request.puzzleNumber),
      ),
    };
  } catch (error) {
    response = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Scoring failed.',
    };
  }

  self.postMessage(response);
});
