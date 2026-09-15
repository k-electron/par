/**
 * Scoring, off the main thread.
 *
 * Spec §9: scoring must not block or freeze the interface. A full game's score
 * is tens of milliseconds of tight numeric work over a few hundred candidates,
 * which is fast but not free, and doing it inline would drop frames exactly as
 * the results view animates in.
 */

import { scoreDirectly } from '../app/scoring/direct';
import type { ScoreRequest, ScoreResponse } from '../app/scoring/protocol';

self.addEventListener('message', (event: MessageEvent<ScoreRequest>) => {
  const request = event.data;

  let response: ScoreResponse;
  try {
    response = {
      id: request.id,
      ok: true,
      score: scoreDirectly(request),
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
