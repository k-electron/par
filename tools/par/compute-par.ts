/**
 * Recompute `PAR` and write it into src/engine/config/par.generated.ts.
 *
 * `PAR` is the mean guess count for strong play opening from house starters.
 * Deliberately not average-human play: if par were the average result, half the
 * field would be under par on any given day and the phrase would mean nothing.
 *
 * Run this whenever the word lists change. A stale PAR leaves every total
 * mis-centred — it cancels between two players on the same day, so it never
 * makes the competition unfair, but it does make the golf framing lie.
 *
 *   npm run compute-par -- --days 300
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';

import { WORD_LIST_VERSION } from '../../src/data';
import { GENERATED_PAR_V1, GENERATED_PAR_V2 } from '../../src/engine/config/par.generated';
import type { DayResult, WorkerTask } from './compute-par-worker';
import { lists, listsV2, play, puzzlesFor, rulesetFor, v2Lexicon } from './simulate';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../src/engine/config/par.generated.ts');

function parseArgs(argv: readonly string[]): { days: number; isV2: boolean; workers: number } {
  const isV1 = argv.includes('--v1');
  const isV2 = argv.includes('--v2') || !isV1;
  const flag = argv.indexOf('--days');
  const days = flag >= 0 ? Number(argv[flag + 1]) : 300;
  if (!Number.isSafeInteger(days) || days <= 0) {
    throw new RangeError(`--days needs a positive integer, got ${days}`);
  }
  const workerFlag = argv.indexOf('--workers');
  const defaultWorkers = Math.max(1, Math.min(8, cpus().length - 1));
  const workers = workerFlag >= 0 ? Number(argv[workerFlag + 1]) : defaultWorkers;
  return { days, isV2, workers };
}

async function main(): Promise<void> {
  const { days, isV2, workers } = parseArgs(process.argv.slice(2));

  const distribution = new Map<number, number>();
  let totalGuesses = 0;
  let unsolved = 0;
  let bestOpenerGuesses = 0;
  const started = Date.now();

  if (workers <= 1) {
    const ruleset = rulesetFor('normal');
    const puzzles = isV2 ? puzzlesFor(days, 260, listsV2) : puzzlesFor(days, 0, lists);
    const activeLexicon = isV2 ? v2Lexicon : undefined;

    for (const [index, puzzle] of puzzles.entries()) {
      const fromHouse = play({
        opener: puzzle.starter,
        answer: puzzle.answer,
        ruleset,
        continuation: 'strong',
        activeLexicon,
      });

      totalGuesses += fromHouse.guessesUsed;
      if (!fromHouse.solved) unsolved += 1;
      distribution.set(fromHouse.guessesUsed, (distribution.get(fromHouse.guessesUsed) ?? 0) + 1);

      bestOpenerGuesses += play({
        opener: FIXED_STRONG_OPENER,
        answer: puzzle.answer,
        ruleset,
        continuation: 'strong',
        activeLexicon,
      }).guessesUsed;

      if ((index + 1) % 5 === 0 || index + 1 === days) {
        process.stdout.write(`  ${index + 1}/${days} days\r`);
      }
    }
  } else {
    const slices: number[][] = Array.from({ length: workers }, () => []);
    for (let i = 0; i < days; i += 1) {
      slices[i % workers]!.push(i);
    }

    let completedDays = 0;
    const results: DayResult[] = [];

    await Promise.all(
      slices
        .filter((slice) => slice.length > 0)
        .map((dayIndices) => {
          return new Promise<void>((resolvePromise, rejectPromise) => {
            const worker = new Worker(resolve(HERE, 'compute-par-worker.ts'), {
              execArgv: ['--import', 'tsx'],
              workerData: { dayIndices, isV2 } satisfies WorkerTask,
            });
            worker.on('message', (msg: DayResult) => {
              results.push(msg);
              completedDays += 1;
              if (completedDays % 5 === 0 || completedDays === days) {
                process.stdout.write(`  ${completedDays}/${days} days\r`);
              }
            });
            worker.on('error', rejectPromise);
            worker.on('exit', (code) => {
              if (code !== 0) {
                rejectPromise(new Error(`Worker stopped with exit code ${code}`));
              } else {
                resolvePromise();
              }
            });
          });
        }),
    );

    for (const r of results) {
      totalGuesses += r.guessesUsed;
      if (!r.solved) unsolved += 1;
      distribution.set(r.guessesUsed, (distribution.get(r.guessesUsed) ?? 0) + 1);
      bestOpenerGuesses += r.fixedGuessesUsed;
    }
  }

  const par = totalGuesses / days;
  const fromFixed = bestOpenerGuesses / days;
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  process.stdout.write('\n');
  console.log(`mode                ${isV2 ? 'v2 (weighted, 260+)' : 'v1 (unweighted, 0-259)'}`);
  console.log(`workers             ${workers}`);
  console.log(`days simulated      ${days}`);
  console.log(`word lists          ${WORD_LIST_VERSION}`);
  console.log(`PAR (house starter) ${par.toFixed(4)}`);
  console.log(`  from ${FIXED_STRONG_OPENER.toUpperCase()}          ${fromFixed.toFixed(4)}`);
  console.log(`  starter costs     ${(par - fromFixed).toFixed(4)} guesses`);
  console.log(`unsolved            ${unsolved}`);
  console.log('distribution');
  for (const guesses of [...distribution.keys()].sort((a, b) => a - b)) {
    const count = distribution.get(guesses)!;
    console.log(`  ${guesses}: ${String(count).padStart(4)}  ${'█'.repeat(Math.round((60 * count) / days))}`);
  }
  console.log(`took                ${elapsed}s`);

  const parV1 = isV2 ? GENERATED_PAR_V1 : par;
  const parV2 = isV2 ? par : GENERATED_PAR_V2;

  writeFileSync(OUTPUT, render(parV1, parV2, days), 'utf8');
  console.log(`\nwrote ${OUTPUT}`);
}

/**
 * A fixed, strong opener used only as a yardstick for what the house starter
 * costs. Not shipped, and never suggested to a player.
 */
const FIXED_STRONG_OPENER = 'slate';

function render(parV1: number, parV2: number, days: number): string {
  return `// Generated by tools/par/compute-par.ts. Do not edit by hand.
//
// The mean guess count for strong play opening from house starters, over
// ${days} simulated days against word lists ${WORD_LIST_VERSION}.
//
// Regenerate whenever the word lists change: PAR is derived from them, and a
// stale value leaves every total mis-centred. See docs/scoring.md.

export const GENERATED_PAR_V1 = ${parV1.toFixed(4)};
export const GENERATED_PAR_V2 = ${parV2.toFixed(4)};
export const GENERATED_PAR = GENERATED_PAR_V1;
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
