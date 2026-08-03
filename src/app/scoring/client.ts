/**
 * The ScoringClient facade.
 *
 * The UI asks for a score and gets a promise. It does not know, and must not
 * need to know, that the work happens on another thread — which is also what
 * lets tests swap in a direct implementation and skip worker plumbing
 * altogether.
 *
 * Results are cached per game. Spec §9 asks that revisiting a finished day be
 * immediate, and a game's score is a pure function of its guesses, its answer
 * and its two settings, so caching it is safe rather than merely convenient.
 */

import type { GameScore, ScoreRequest, ScoreResponse } from './protocol';

export interface ScoreQuery {
  readonly guesses: readonly string[];
  readonly answer: string;
  readonly tookHouseStarter: boolean;
  readonly hardMode: boolean;
}

export interface ScoringClient {
  score(query: ScoreQuery): Promise<GameScore>;
  dispose(): void;
}

function cacheKey(query: ScoreQuery): string {
  return [
    query.hardMode ? 'h' : 'n',
    query.tookHouseStarter ? 's' : 'o',
    query.answer,
    ...query.guesses,
  ].join('|');
}

/** Wrap any scorer with a per-game cache. */
function withCache(score: (query: ScoreQuery) => Promise<GameScore>): ScoringClient {
  const cache = new Map<string, Promise<GameScore>>();
  return {
    score(query) {
      const key = cacheKey(query);
      let pending = cache.get(key);
      if (pending === undefined) {
        pending = score(query);
        cache.set(key, pending);
        // A failure must not be cached, or a transient worker error would
        // poison that game for the rest of the session.
        pending.catch(() => cache.delete(key));
      }
      return pending;
    },
    dispose() {
      cache.clear();
    },
  };
}

/** Score in a worker. The shipped implementation. */
export function createWorkerScoringClient(): ScoringClient {
  const worker = new Worker(new URL('../../worker/scoring.worker.ts', import.meta.url), {
    type: 'module',
  });

  const pending = new Map<number, { resolve: (score: GameScore) => void; reject: (error: Error) => void }>();
  let nextId = 1;

  worker.addEventListener('message', (event: MessageEvent<ScoreResponse>) => {
    const response = event.data;
    const waiting = pending.get(response.id);
    if (waiting === undefined) return;
    pending.delete(response.id);

    if (response.ok) waiting.resolve(response.score);
    else waiting.reject(new Error(response.error));
  });

  worker.addEventListener('error', (event) => {
    // The worker died. Fail everything waiting rather than hanging the UI.
    const error = new Error(event.message || 'The scoring worker failed.');
    for (const waiting of pending.values()) waiting.reject(error);
    pending.clear();
  });

  const client = withCache(
    (query) =>
      new Promise<GameScore>((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        const request: ScoreRequest = { id, ...query };
        worker.postMessage(request);
      }),
  );

  return {
    score: client.score,
    dispose() {
      client.dispose();
      worker.terminate();
    },
  };
}
