/**
 * The shared artefact: an emoji grid anyone recognises, and a link that hides
 * everything.
 *
 * The text is the social object and the link is the receipt. The text must spoil
 * nothing — never the words, never the answer — while the link reconstructs the
 * whole game one click deeper.
 */

import { MAX_GUESSES, PAR, SCORER_VERSION } from '../../engine/config/constants';
import { Tile, tilesFromPattern } from '../../engine/words/pattern';
import { parPhrase } from '../copy/results';
import type { GameScore } from '../scoring/protocol';
import { encodeSharedGame } from './codec';

const TILE_EMOJI: Record<Tile, string> = {
  [Tile.Absent]: '\u2B1C',
  [Tile.Present]: '\u{1F7E8}',
  [Tile.Correct]: '\u{1F7E9}',
};

export interface ShareInput {
  readonly puzzleNumber: number;
  readonly score: GameScore;
  readonly hardMode: boolean;
  readonly tookHouseStarter: boolean;
  readonly guessIndices: readonly number[];
  readonly wordListVersion: string;
  /** Where the app lives, so the link is clickable. */
  readonly origin: string;
}

/** The replay link. The payload rides in the fragment. */
export function replayLink(input: ShareInput): string {
  const payload = encodeSharedGame({
    puzzleNumber: input.puzzleNumber,
    hardMode: input.hardMode,
    tookHouseStarter: input.tookHouseStarter,
    guessIndices: input.guessIndices,
    wordListVersion: input.wordListVersion,
    scorerVersion: SCORER_VERSION,
  });

  // The fragment, not the query string: it is never sent to a server, and there
  // is no server here to send it to anyway.
  return `${input.origin.replace(/\/+$/, '')}/#r=${payload}`;
}

/**
 * The grid, plus the score, plus badges. No words, ever.
 *
 * Badges name the factual — house starter, hard mode, solved or not — and the
 * celebratory. The celebratory ones are how a hole in one gets recognised, and
 * they are cosmetic by design: they carry no points.
 */
export function shareText(input: ShareInput): string {
  const { score } = input;

  const grid = score.breakdown
    .map((row) =>
      tilesFromPattern(row.pattern)
        .map((tile) => TILE_EMOJI[tile])
        .join(''),
    )
    .join('\n');

  const badges: string[] = [];
  if (input.tookHouseStarter) badges.push('\u{1F3E0} house starter');
  if (input.hardMode) badges.push('\u2699\uFE0F hard');
  if (score.solved && score.guessesUsed === 1) badges.push('\u{1F3AF} hole in one');
  else if (score.solved && score.guessesUsed <= 3) badges.push('\u26A1 quick round');
  if (score.solved && score.skill >= 97) badges.push('\u2728 clean round');

  const attempts = `${score.solved ? score.guessesUsed : 'X'}/${MAX_GUESSES}`;

  const lines = [
    `Par ${input.puzzleNumber} ${attempts} \u2014 ${score.total.toFixed(1)}`,
    `${score.skill.toFixed(0)}% \u00B7 ${parPhrase(score.guessesUsed, PAR, score.solved)}`,
    ...(badges.length > 0 ? [badges.join(' \u00B7 ')] : []),
    '',
    grid,
    '',
    replayLink(input),
  ];

  return lines.join('\n');
}
