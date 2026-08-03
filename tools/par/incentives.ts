/**
 * Check that the incentives still point the right way.
 *
 * Philosophy position 5 names the ordering the design targets, in expectation
 * over the long run:
 *
 *   house starter + play well  >  own opener + play well
 *                              >  house starter, then ignore it and play well
 *
 * The first gap is the bonus doing its job: taking the shared starter should be
 * the mildly better habit, so a bookmark player pays a small tax every day. The
 * second gap matters more — taking the bonus and then reverting to a memorised
 * word must be clearly the worst of the three, or the bonus is free money.
 *
 * This was validated against the author's word lists. Ours are generated fresh
 * and `PAR` is recomputed against them, so it needs re-confirming rather than
 * inheriting. Spec §3 asks for exactly this when the lists change.
 *
 *   npm run check-incentives -- --days 150
 */

import { EPSILON, C_PAR } from '../../src/engine/config/constants';
import { WORD_LIST_VERSION } from '../../src/data';
import { play, puzzlesFor, rulesetFor, scorePlayed } from './simulate';

/** A memorised opener, replayed regardless of what the clues said. */
const BOOKMARK = 'adieu';

interface Tally {
  readonly label: string;
  total: number;
  guesses: number;
  skill: number;
  games: number;
}

function parseDays(argv: readonly string[]): number {
  const flag = argv.indexOf('--days');
  if (flag < 0) return 150;
  const value = Number(argv[flag + 1]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`--days needs a positive integer, got ${argv[flag + 1]}`);
  }
  return value;
}

function main(): void {
  const days = parseDays(process.argv.slice(2));
  const ruleset = rulesetFor('normal');
  const puzzles = puzzlesFor(days);

  const houseWell: Tally = { label: 'house starter + play well', total: 0, guesses: 0, skill: 0, games: 0 };
  const ownWell: Tally = { label: 'own opener + play well', total: 0, guesses: 0, skill: 0, games: 0 };
  const houseThenBookmark: Tally = { label: 'house starter, then revert', total: 0, guesses: 0, skill: 0, games: 0 };

  function record(tally: Tally, score: { total: number; guessesUsed: number; skill: number }) {
    tally.total += score.total;
    tally.guesses += score.guessesUsed;
    tally.skill += score.skill;
    tally.games += 1;
  }

  const started = Date.now();
  for (const [index, puzzle] of puzzles.entries()) {
    const house = play({
      opener: puzzle.starter,
      answer: puzzle.answer,
      ruleset,
      continuation: 'strong',
    });
    record(houseWell, scorePlayed(house, puzzle.answer, ruleset, true));

    const own = play({
      opener: BOOKMARK,
      answer: puzzle.answer,
      ruleset,
      continuation: 'strong',
    });
    record(ownWell, scorePlayed(own, puzzle.answer, ruleset, false));

    const reverted = play({
      opener: puzzle.starter,
      answer: puzzle.answer,
      ruleset,
      continuation: 'bookmark',
      bookmark: BOOKMARK,
    });
    record(houseThenBookmark, scorePlayed(reverted, puzzle.answer, ruleset, true));

    if ((index + 1) % 10 === 0) process.stdout.write(`  ${index + 1}/${days} days\r`);
  }

  process.stdout.write('\n');
  console.log(`days simulated  ${days}`);
  console.log(`word lists      ${WORD_LIST_VERSION}`);
  console.log(`C_PAR ${C_PAR}, EPSILON ${EPSILON}, bookmark ${BOOKMARK.toUpperCase()}\n`);

  const ordered = [houseWell, ownWell, houseThenBookmark];
  console.log('strategy                      mean total   mean guesses   mean skill');
  for (const tally of ordered) {
    console.log(
      `${tally.label.padEnd(30)}${(tally.total / tally.games).toFixed(2).padStart(10)}` +
        `${(tally.guesses / tally.games).toFixed(3).padStart(15)}` +
        `${(tally.skill / tally.games).toFixed(1).padStart(13)}`,
    );
  }

  const houseMean = houseWell.total / houseWell.games;
  const ownMean = ownWell.total / ownWell.games;
  const revertMean = houseThenBookmark.total / houseThenBookmark.games;

  console.log('\nordering');
  report('house beats own opener', houseMean - ownMean);
  report('own opener beats reverting', ownMean - revertMean);

  console.log(`\ntook ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (houseMean <= ownMean || ownMean <= revertMean) {
    console.error('\nThe position 5 ordering does not hold. Do not ship this configuration.');
    process.exitCode = 1;
  }
}

function report(claim: string, gap: number): void {
  const verdict = gap > 0 ? 'holds' : 'FAILS';
  console.log(`  ${claim.padEnd(30)} ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} points  ${verdict}`);
}

main();
