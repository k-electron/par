/**
 * The message contract between the app and the scoring worker.
 *
 * Kept in its own module because both sides import it and neither should import
 * the other. Everything crossing the boundary is structured-clone safe: plain
 * objects, numbers, strings and booleans.
 */

import type { GameScore } from '../../engine/score/scoreGame';

export interface ScoreRequest {
  readonly id: number;
  readonly guesses: readonly string[];
  readonly answer: string;
  readonly tookHouseStarter: boolean;
  readonly hardMode: boolean;
}

export type ScoreResponse =
  | { readonly id: number; readonly ok: true; readonly score: GameScore }
  | { readonly id: number; readonly ok: false; readonly error: string };

export type { GameScore };
