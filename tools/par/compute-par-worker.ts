import { parentPort, workerData } from 'node:worker_threads';
import { drawPuzzle } from '../../src/engine/daily/puzzle';
import { lists, listsV2, play, rulesetFor, v2Lexicon } from './simulate';

const FIXED_STRONG_OPENER = 'slate';

export interface WorkerTask {
  readonly dayIndices: readonly number[];
  readonly isV2: boolean;
}

export interface DayResult {
  readonly dayIndex: number;
  readonly guessesUsed: number;
  readonly solved: boolean;
  readonly fixedGuessesUsed: number;
}

function run(): void {
  const { dayIndices, isV2 } = workerData as WorkerTask;
  const ruleset = rulesetFor('normal');
  const activeLexicon = isV2 ? v2Lexicon : undefined;

  for (const dayIndex of dayIndices) {
    const puzzle = isV2
      ? drawPuzzle(260 + dayIndex, listsV2)
      : drawPuzzle(dayIndex, lists);

    const fromHouse = play({
      opener: puzzle.starter,
      answer: puzzle.answer,
      ruleset,
      continuation: 'strong',
      activeLexicon,
    });

    const fromFixed = play({
      opener: FIXED_STRONG_OPENER,
      answer: puzzle.answer,
      ruleset,
      continuation: 'strong',
      activeLexicon,
    });

    const result: DayResult = {
      dayIndex,
      guessesUsed: fromHouse.guessesUsed,
      solved: fromHouse.solved,
      fixedGuessesUsed: fromFixed.guessesUsed,
    };

    parentPort?.postMessage(result);
  }
}

run();
