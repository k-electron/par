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

import { answers, guesses } from '../data';
import { rulesetFor } from '../engine/rules/ruleset';
import { scoreGame } from '../engine/score/scoreGame';
import { createPositionScorer, type PositionScorer } from '../engine/score/scoreGuess';
import { validatedPolicy } from '../engine/search/policy';
import { compileLexicon, type CompiledLexicon } from '../engine/words/lexicon';
import type { ScoreRequest, ScoreResponse } from '../app/scoring/protocol';

let lexicon: CompiledLexicon | undefined;

function lexiconOnce(): CompiledLexicon {
  lexicon ??= compileLexicon({ guesses, answers });
  return lexicon;
}

/**
 * A fresh scorer per request.
 *
 * Deliberate: the scorer caches a pattern matrix keyed to one game's candidate
 * set, and reusing it across games would either rebuild constantly or hold a
 * matrix for the wrong position. The lexicon underneath is what is worth
 * keeping, and it is.
 */
function scorerFor(hardMode: boolean): PositionScorer {
  return createPositionScorer({
    lexicon: lexiconOnce(),
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
        },
        scorerFor(request.hardMode),
      ),
    };
  } catch (cause) {
    // A failure here is a bug, not a score. Report it rather than leaving the
    // caller waiting on a promise that never settles.
    response = {
      id: request.id,
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }

  self.postMessage(response);
});
