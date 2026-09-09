/**
 * Simulate any Par puzzle from any era (e.g. Game 300).
 *
 * Usage:
 *   npx tsx tools/par/simulate-game.ts [puzzleNumber]
 *   e.g. npx tsx tools/par/simulate-game.ts 300
 */

import { WORD_LIST_VERSION } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { parFor } from '../../src/engine/config/constants';
import { scoreGame } from '../../src/engine/score/scoreGame';
import { createPositionScorer } from '../../src/engine/score/scoreGuess';
import { validatedPolicy } from '../../src/engine/search/policy';
import { computePattern, tilesFromPattern } from '../../src/engine/words/pattern';
import { replayLink } from '../../src/app/share/share';
import { lists, listsV2, play, rulesetFor, v2Lexicon, lexicon } from './simulate';

function emojiPattern(pattern: number): string {
  return tilesFromPattern(pattern).map((t) => (t === 2 ? '🟩' : t === 1 ? '🟨' : '⬜')).join('');
}

function main() {
  const arg = process.argv[2];
  const puzzleNumber = arg !== undefined ? Number(arg) : 300;
  if (!Number.isSafeInteger(puzzleNumber) || puzzleNumber < 0) {
    console.error('Please specify a non-negative integer puzzle number.');
    process.exit(1);
  }

  const isV2 = puzzleNumber >= 260;
  const puzzleLists = isV2 ? listsV2 : lists;
  const activeLexicon = isV2 ? v2Lexicon : lexicon;
  const puzzle = drawPuzzle(puzzleNumber, puzzleLists);
  const ruleset = rulesetFor('normal');

  console.log(`\n======================================================`);
  console.log(`  SIMULATING PAR GAME #${puzzleNumber} (${isV2 ? 'v2 Era: Weighted' : 'v1 Era: Legacy'})`);
  console.log(`======================================================`);
  console.log(`House Starter: ${puzzle.starter.toUpperCase()}`);
  console.log(`Target Answer: ${puzzle.answer.toUpperCase()}`);
  console.log(`Par Benchmark: ${parFor(puzzleNumber).toFixed(4)}`);
  console.log(`\nSimulating strong play...`);

  const startPlay = Date.now();
  const result = play({
    opener: puzzle.starter,
    answer: puzzle.answer,
    ruleset,
    continuation: 'strong',
    activeLexicon,
  });
  console.log(`Played in ${((Date.now() - startPlay) / 1000).toFixed(1)}s: ${result.guesses.map((g) => g.toUpperCase()).join(' -> ')}`);

  console.log(`\nScoring moves with ${isV2 ? 'Path A weighted Bayesian scorer' : 'v1 uniform scorer'}...`);
  const scorer = createPositionScorer({ lexicon: activeLexicon, ruleset, policy: validatedPolicy });
  const score = scoreGame({
    guesses: result.guesses,
    answer: puzzle.answer,
    tookHouseStarter: true,
    par: parFor(puzzleNumber),
  }, scorer);

  console.log(`\n------------------------------------------------------`);
  console.log(`  SCORE SUMMARY`);
  console.log(`------------------------------------------------------`);
  console.log(`Guesses:        ${score.guessesUsed} / 6 (${score.solved ? 'Solved' : 'Unsolved'})`);
  console.log(`Skill:          ${score.skill.toFixed(1)}%`);
  console.log(`Outcome:        ${score.outcome >= 0 ? '+' : ''}${score.outcome.toFixed(2)} pts`);
  console.log(`Starter Bonus:  +${score.starterBonus} pts`);
  console.log(`TOTAL SCORE:    ${score.total.toFixed(2)} pts`);
  console.log(`------------------------------------------------------`);

  console.log(`\nTurn-by-Turn Play-by-Play:`);
  for (const b of score.breakdown) {
    const pat = computePattern(b.guess, puzzle.answer);
    const emoji = emojiPattern(pat);
    const skillText = b.skill !== null ? `${b.skill.toFixed(1)}%`.padStart(6) : ' (open)';
    const luckSign = b.luck >= 0 ? '+' : '';
    const luckText = `${luckSign}${b.luck.toFixed(2)} bits`.padStart(11);
    const forcedText = b.forced ? ' [FORCED]' : '';
    console.log(`  Turn ${b.turn}: ${b.guess.toUpperCase()}  [${emoji}]  Skill: ${skillText}  Luck: ${luckText}${forcedText}`);
  }

  const guessIndices = result.guesses.map((g) => activeLexicon.guessWords.indexOf(g));

  const localLink = replayLink({
    puzzleNumber,
    score,
    hardMode: false,
    tookHouseStarter: true,
    guessIndices,
    wordListVersion: WORD_LIST_VERSION,
    origin: 'http://localhost:5173',
  });

  const liveLink = replayLink({
    puzzleNumber,
    score,
    hardMode: false,
    tookHouseStarter: true,
    guessIndices,
    wordListVersion: WORD_LIST_VERSION,
    origin: 'https://par-e7i.pages.dev',
  });

  console.log(`\nBrowser Replay Link (click to inspect in browser with interactive explainer):`);
  console.log(`  Local: ${localLink}`);
  console.log(`  Live:  ${liveLink}\n`);
}

main();
