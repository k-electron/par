/**
 * Check that the progress light still says something, and still says it vaguely
 * enough.
 *
 * The light is `log2(before / after) / log2(before)`, banded at a half and a
 * quarter — see `progressLevel` and decision 0003. Two properties make that
 * worth shipping, and both are claims about the word lists rather than about the
 * code, so both go stale when the lists are regenerated:
 *
 * 1. **It discriminates.** Three bands that almost always come out the same
 *    colour would be decoration.
 * 2. **Red is a hint rather than a proof.** A word still possible always
 *    eliminates itself when it fails, so a display that singled out "ruled
 *    nothing out" would prove the guess was never a possible answer. Red covers
 *    that case together with small cuts, which is only worth anything while red
 *    genuinely holds both.
 *
 *   npm run check-lights -- --days 150
 *
 * Exits non-zero if either property has lapsed. It also reports two things the
 * decision claims but cannot fail on: that red does not land on well-judged
 * guesses, and that the light is not the luck figure in another hat.
 *
 * **The simulated player is middling on purpose.** Strong play, which
 * `compute-par` uses, would settle almost every round before the interesting
 * positions arrive: it simply guesses the answer once one word is left, so the
 * cases this is measuring barely occur. This one plays a word that still fits
 * the clues but only its third choice by rough familiarity, which is closer to
 * how a person plays and is the unfavourable end for property 2.
 */

import { PROGRESS, progressLevel, type ProgressLevel } from '../../src/app/copy/results';
import { answers, guesses as dictionary, starters } from '../../src/data';
import { MAX_GUESSES } from '../../src/engine/config/constants';
import { expectedInformationBits } from '../../src/engine/numeric/information';
import { log2 } from '../../src/engine/numeric/log2';
import { WIN_PATTERN, computePattern } from '../../src/engine/words/pattern';
import { filterByHistory, patternCounts, type Observation } from '../../src/engine/words/filter';
import { lists, rulesetFor, scorePlayed } from './simulate';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

/** Bands below this share of the rows mean the light has stopped discriminating. */
const LEAST_INTERESTING_SHARE = 0.05;
/** Above this, red has stopped covering small cuts and only means "no cut". */
const MOST_RED_MAY_TELL = 0.8;
/** How far down the familiar words a simulated player reaches for its guess. */
const CHOICE = 2;

const answerRank = new Map(answers.map((word, index) => [word, index]));
const starterRank = new Map(starters.map((word, index) => [word, index]));

/**
 * A rough stand-in for how readily a person thinks of a word.
 *
 * Both shipped lists are frequency-ranked, so their indices are a usable proxy
 * and need no second corpus. Words in neither are the ones a player reaches for
 * last.
 */
function familiarity(word: string): number {
  const asAnswer = answerRank.get(word);
  if (asAnswer !== undefined) return asAnswer;
  const asStarter = starterRank.get(word);
  if (asStarter !== undefined) return answers.length + asStarter;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * What share of the best available expected information the guess asked for.
 *
 * A decision measure, not an outcome one: it cannot see the answer, so a guess
 * that read the position well and then got poor tiles still scores near one. The
 * whole dictionary is scanned rather than a shortlist, because the question is
 * whether anything better existed at all.
 */
function quality(guess: string, live: readonly string[]): number {
  const asked = expectedInformationBits(patternCounts(guess, live), live.length);
  let best = 0;
  for (const option of dictionary) {
    const bits = expectedInformationBits(patternCounts(option, live), live.length);
    if (bits > best) best = bits;
  }
  return best === 0 ? 1 : asked / best;
}

function stillFits(history: readonly Observation[]): string[] {
  return dictionary.filter((word) =>
    history.every((observation) => computePattern(observation.guess, word) === observation.pattern),
  );
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

/** Positions small enough for a red light to sit visibly beside a perfect score. */
const ENDGAME = 12;

interface Row {
  readonly turn: number;
  readonly before: number;
  readonly after: number;
  readonly level: ProgressLevel;
  readonly ruledNothingOut: boolean;
  /** Realized minus expected bits: the luck figure, for the same guess. */
  readonly luck: number;
  /**
   * How near the guess came to the most informative word in the dictionary,
   * judged before the tiles turned. Only worked out for endgame positions, which
   * is where a red light beside a well-judged guess would be seen.
   */
  readonly decisionQuality: number | null;
}

/** One round of middling play, as the results table would light it. */
function playRound(puzzleNumber: number): { rows: Row[]; guesses: string[]; answer: string } {
  const { answer, starter } = drawPuzzle(puzzleNumber, lists);
  const history: Observation[] = [];
  const guesses: string[] = [];
  const rows: Row[] = [];

  for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
    const options =
      turn === 0 ? [starter] : [...stillFits(history)].sort((a, b) => familiarity(a) - familiarity(b));
    if (options.length === 0) break;

    const guess = options[Math.min(CHOICE, options.length - 1)]!;
    const live = filterByHistory(answers, history);
    const before = live.length;
    const expected = expectedInformationBits(patternCounts(guess, live), Math.max(1, before));
    const decisionQuality = before >= 2 && before <= ENDGAME ? quality(guess, live) : null;
    const pattern = computePattern(guess, answer);

    guesses.push(guess);
    history.push({ guess, pattern });
    const after = filterByHistory(answers, history).length;

    rows.push({
      turn: turn + 1,
      before,
      after,
      level: progressLevel(before, after, pattern === WIN_PATTERN),
      ruledNothingOut: after >= before,
      luck: log2(before / after) - expected,
      decisionQuality,
    });

    if (pattern === WIN_PATTERN) break;
  }

  return { rows, guesses, answer };
}

/**
 * The counts this reads back are the ones the scorer reports, so spot-check a
 * few rounds against the shipped scoring path rather than trusting that two
 * pieces of filtering agree.
 */
function confirmAgainstScorer(puzzleNumbers: readonly number[]): void {
  const ruleset = rulesetFor('normal');

  for (const puzzleNumber of puzzleNumbers) {
    const { rows, guesses, answer } = playRound(puzzleNumber);
    const scored = scorePlayed(
      { guesses, solved: rows.at(-1)?.level === 'solved', guessesUsed: guesses.length },
      answer,
      ruleset,
      true,
    );

    scored.breakdown.forEach((entry, index) => {
      const row = rows[index]!;
      if (entry.candidateCount !== row.before || entry.remainingCount !== row.after) {
        throw new Error(
          `puzzle ${puzzleNumber} turn ${entry.turn}: scorer says ` +
            `${entry.candidateCount}->${entry.remainingCount}, this says ${row.before}->${row.after}`,
        );
      }
    });
  }
}

/** How closely the light's underlying share tracks the luck figure. */
function correlation(rows: readonly Row[]): number {
  const usable = rows.filter((row) => row.before > 1 && Number.isFinite(row.luck));
  const shares = usable.map((row) => log2(row.before / row.after) / log2(row.before));
  const lucks = usable.map((row) => row.luck);
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanShare = mean(shares);
  const meanLuck = mean(lucks);

  let covariance = 0;
  let shareSpread = 0;
  let luckSpread = 0;
  for (let index = 0; index < usable.length; index += 1) {
    const share = shares[index]! - meanShare;
    const luck = lucks[index]! - meanLuck;
    covariance += share * luck;
    shareSpread += share * share;
    luckSpread += luck * luck;
  }

  return covariance / Math.sqrt(shareSpread * luckSpread);
}

function main(): void {
  const days = parseDays(process.argv.slice(2));
  const puzzleNumbers = Array.from({ length: days }, (_, offset) => offset);

  confirmAgainstScorer(puzzleNumbers.slice(0, 3));

  const rows = puzzleNumbers.flatMap((puzzleNumber) => playRound(puzzleNumber).rows);
  // The winning row is not a band, it is an outcome, so it is left out of the
  // shares a band has to clear.
  const banded = rows.filter((row) => row.level !== 'solved');
  const share = (level: ProgressLevel) =>
    banded.filter((row) => row.level === level).length / banded.length;

  const red = banded.filter((row) => row.level === 'slight');
  const redTells = red.filter((row) => row.ruledNothingOut).length / Math.max(1, red.length);

  console.log(`${days} days of middling play, ${rows.length} rows\n`);
  console.log('  light                 rows    share');
  for (const level of ['major', 'minor', 'slight', 'none'] as const) {
    const count = banded.filter((row) => row.level === level).length;
    console.log(
      `  ${PROGRESS[level].padEnd(20)} ${String(count).padStart(5)}   ${(share(level) * 100)
        .toFixed(1)
        .padStart(5)}%`,
    );
  }

  console.log('\n  by turn');
  for (let turn = 1; turn <= MAX_GUESSES; turn += 1) {
    const onTurn = rows.filter((row) => row.turn === turn);
    if (onTurn.length === 0) continue;
    const count = (level: ProgressLevel) =>
      String(onTurn.filter((row) => row.level === level).length).padStart(4);
    console.log(
      `  turn ${turn}: big ${count('major')}  fair ${count('minor')}  ` +
        `little ${count('slight')}  unlit ${count('none')}  solved ${count('solved')}`,
    );
  }

  console.log(
    `\n  red rows that had ruled nothing out: ${red.filter((row) => row.ruledNothingOut).length}` +
      ` of ${red.length} (${(redTells * 100).toFixed(0)}%)`,
  );
  console.log(
    `  unlit rows, where no uncertainty was left to remove: ` +
      `${banded.filter((row) => row.level === 'none').length}`,
  );

  // Does red ever land on a guess that read the position well? If it did, the
  // light would be contradicting the skill column beside it.
  const judged = red.filter((row) => row.decisionQuality !== null);
  const wellJudged = judged.filter((row) => (row.decisionQuality ?? 0) >= 0.9);
  console.log(
    `  red rows whose guess asked for 90% or more of the best information available: ` +
      `${wellJudged.length} of ${judged.length} endgame red rows judged`,
  );

  // And is it just the luck column? Both are driven by what the tiles did, so
  // some agreement is expected; near-identity would make one of them redundant.
  console.log(`  correlation with the luck figure: ${correlation(banded).toFixed(2)}`);

  const complaints: string[] = [];
  for (const level of ['major', 'minor', 'slight'] as const) {
    if (share(level) < LEAST_INTERESTING_SHARE) {
      complaints.push(
        `"${PROGRESS[level]}" lights ${(share(level) * 100).toFixed(1)}% of rows, under the ` +
          `${(LEAST_INTERESTING_SHARE * 100).toFixed(0)}% a band has to earn to be worth a colour`,
      );
    }
  }
  if (redTells > MOST_RED_MAY_TELL) {
    complaints.push(
      `red means "ruled nothing out" ${(redTells * 100).toFixed(0)}% of the time, over the ` +
        `${(MOST_RED_MAY_TELL * 100).toFixed(0)}% at which it stops being a band and starts ` +
        `being a proof that the guess was never a possible answer`,
    );
  }

  if (complaints.length > 0) {
    console.error('\nThe light no longer holds its side of decision 0003:');
    for (const complaint of complaints) console.error(`  - ${complaint}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nThe light discriminates, and red still covers small cuts as well as none.');
}

main();
