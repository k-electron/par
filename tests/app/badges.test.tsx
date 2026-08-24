/**
 * Which badges a finished round earns, and that both surfaces agree about it.
 *
 * This replaced a 768-row snapshot. The snapshot existed to hold one refactor
 * honest and did that job, but as a standing test it was unreadable: of its rows
 * about eight carried information and the rest were filler, so a real regression
 * would have arrived as a wall of diff that nobody could review. The realistic
 * response to that is `vitest -u`, which accepts whatever the code now does. A
 * test that gets rubber-stamped is worse than no test, because it reads as
 * coverage.
 *
 * So the rules are stated instead, and a failure names the rule it broke. The
 * cross-product is still covered, by the property at the bottom — but as an
 * invariant rather than a transcript.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  celebratoryBadges,
  resultsBadges,
  type CelebratoryBadge,
} from '../../src/app/copy/results';
import { shareText } from '../../src/app/share/share';
import { theme } from '../../src/app/theme/theme';
import { Results } from '../../src/app/ui/Results';
import { WORD_LIST_VERSION } from '../../src/data';
import {
  CLEAN_ROUND_SKILL,
  MAX_GUESSES,
  QUICK_ROUND_GUESSES,
} from '../../src/engine/config/constants';
import type { GameScore, GuessBreakdown } from '../../src/engine/score/scoreGame';

afterEach(cleanup);

/**
 * The words each surface uses, written out rather than imported.
 *
 * Importing them would make the assertions circular — they would agree with the
 * source however the source changed. Spelling them out is the test saying what a
 * player should read.
 */
const IN_RESULTS: Record<CelebratoryBadge, string> = {
  holeInOne: 'Hole in one',
  quickRound: 'Quick round',
  cleanRound: 'Clean round',
};

const IN_SHARE: Record<CelebratoryBadge, string> = {
  holeInOne: '\u{1F3AF} hole in one',
  quickRound: '\u26A1 quick round',
  cleanRound: '\u2728 clean round',
};

function scoreWith(solved: boolean, guessesUsed: number, skill: number): GameScore {
  const breakdown: GuessBreakdown[] = Array.from({ length: guessesUsed }, (_, index) => ({
    turn: index + 1,
    guess: 'crane',
    pattern: 0,
    candidateCount: 100,
    remainingCount: 10,
    skill: index === 0 ? null : skill,
    weight: index === 0 ? 0 : 1,
    luck: 0,
    forced: false,
    wasCandidate: false,
    outcomeShare: 0.1,
    likeliestOutcomeShare: 0.2,
  }));

  return { skill, outcome: 0, starterBonus: 0, total: skill, guessesUsed, solved, breakdown };
}

const SETTINGS = { hardMode: false, useHouseStarter: true };

/** The badge line of the shared text, which sits third by construction. */
function shareBadgeLine(
  score: GameScore,
  settings: { hardMode: boolean; useHouseStarter: boolean } = SETTINGS,
): string {
  const text = shareText({
    puzzleNumber: 214,
    score,
    hardMode: settings.hardMode,
    tookHouseStarter: settings.useHouseStarter,
    guessIndices: Array.from({ length: score.guessesUsed }, () => 0),
    wordListVersion: WORD_LIST_VERSION,
    origin: 'https://example.test',
  });
  return text.split('\n')[2] ?? '';
}

/** Just the celebratory badges, in order, as that surface words them. */
function celebratoryIn(surface: 'results' | 'share', score: GameScore): string[] {
  if (surface === 'results') {
    const words = Object.values(IN_RESULTS);
    return resultsBadges(score, SETTINGS).filter((badge) => words.includes(badge));
  }
  const words: string[] = Object.values(IN_SHARE);
  return shareBadgeLine(score)
    .split(' \u00B7 ')
    .filter((badge) => words.includes(badge));
}

describe('the clean round threshold', () => {
  it(`is earned at exactly ${CLEAN_ROUND_SKILL}%`, () => {
    const score = scoreWith(true, 4, CLEAN_ROUND_SKILL);
    expect(celebratoryIn('results', score)).toContain('Clean round');
    expect(celebratoryIn('share', score)).toContain('\u2728 clean round');
  });

  /**
   * The float edge, and the reason it is worth a test of its own. A threshold
   * written as `> 96.99` instead of `>= 97` passes every round number and fails
   * only here — 96.99999999999999 clears 96.99 but is not 97, and skill is a
   * computed float that lands on values like it.
   */
  it('is not earned a mantissa bit below it', () => {
    const score = scoreWith(true, 4, 96.99999999999999);
    expect(celebratoryIn('results', score)).not.toContain('Clean round');
    expect(celebratoryIn('share', score)).not.toContain('\u2728 clean round');
  });

  /**
   * The badge grades decisions, not speed. A player who read a brutal answer
   * perfectly and still needed five guesses earns it; the outcome term has
   * already priced the guess count and must not price it twice.
   */
  it('does not care how many guesses it took', () => {
    const slowButPerfect = scoreWith(true, MAX_GUESSES, 100);
    expect(celebratoryIn('results', slowButPerfect)).toContain('Clean round');
  });
});

describe('the quick round badge', () => {
  it(`is earned at ${QUICK_ROUND_GUESSES} guesses and not at ${QUICK_ROUND_GUESSES + 1}`, () => {
    expect(celebratoryIn('results', scoreWith(true, QUICK_ROUND_GUESSES, 50))).toContain(
      'Quick round',
    );
    expect(celebratoryIn('results', scoreWith(true, QUICK_ROUND_GUESSES + 1, 50))).not.toContain(
      'Quick round',
    );
  });

  it('gives way to hole in one rather than doubling up', () => {
    const oneGuess = scoreWith(true, 1, 50);
    expect(celebratoryIn('results', oneGuess)).toEqual(['Hole in one']);
    expect(celebratoryIn('share', oneGuess)).toEqual(['\u{1F3AF} hole in one']);
  });
});

describe('an unsolved round', () => {
  it('earns no celebratory badge however well it was played', () => {
    for (const skill of [50, CLEAN_ROUND_SKILL, 100]) {
      const lost = scoreWith(false, MAX_GUESSES, skill);
      expect(celebratoryIn('results', lost), `skill ${skill}`).toEqual([]);
      expect(celebratoryIn('share', lost), `skill ${skill}`).toEqual([]);
    }
  });
});

describe('the two surfaces differ only where intended', () => {
  /**
   * Spec §7 wants the shared text read at a glance. Its first line already says
   * `4/6` or `X/6`, so a badge repeating it is noise, and the absence of the
   * starter badge already says the opener was the player's own. The results
   * screen has no such line and spells both out.
   */
  it('omits from the shared text what its attempt line already carries', () => {
    const won = scoreWith(true, 4, 50);
    expect(resultsBadges(won, { hardMode: false, useHouseStarter: false })).toEqual([
      'Own opener',
      'Solved',
    ]);
    expect(shareBadgeLine(won, { hardMode: false, useHouseStarter: false })).toBe('');
  });

  it('names hard mode on both, in their own register', () => {
    const won = scoreWith(true, 4, 50);
    expect(resultsBadges(won, { hardMode: true, useHouseStarter: true })).toContain('Hard mode');
    expect(shareBadgeLine(won, { hardMode: true, useHouseStarter: true })).toContain(
      '\u2699\uFE0F hard',
    );
  });
});

describe('both surfaces follow the one rule', () => {
  /**
   * The invariant the shared predicate exists for, over every input that can
   * change the answer. This is what the snapshot was really protecting, said as a
   * property: whatever `celebratoryBadges` decides, each surface shows exactly
   * that, in that order, in its own words. A call site wired up wrongly fails
   * here and names itself.
   */
  it('shows exactly the badges the predicate awards, in order', () => {
    let checked = 0;

    for (const solved of [true, false]) {
      for (let guessesUsed = 1; guessesUsed <= MAX_GUESSES; guessesUsed += 1) {
        for (const skill of [0.1, 50, 96.99999999999999, CLEAN_ROUND_SKILL, 99, 100]) {
          const score = scoreWith(solved, guessesUsed, skill);
          const awarded = celebratoryBadges(score);
          const where = `solved=${solved} guesses=${guessesUsed} skill=${skill}`;

          expect(celebratoryIn('results', score), `results, ${where}`).toEqual(
            awarded.map((badge) => IN_RESULTS[badge]),
          );
          expect(celebratoryIn('share', score), `share, ${where}`).toEqual(
            awarded.map((badge) => IN_SHARE[badge]),
          );
          checked += 1;
        }
      }
    }

    expect(checked).toBe(2 * MAX_GUESSES * 6);
  });
});

describe('the results view', () => {
  /**
   * Everything above reads the badge functions rather than the rendered view.
   * This is what stops the component drifting from them — dropping a badge,
   * reordering the row, or wording one on its own.
   */
  it.each([
    [true, 1, 100, true, true],
    [true, 3, 100, false, false],
    [true, 4, CLEAN_ROUND_SKILL, true, false],
    [true, 5, 50, false, true],
    [false, MAX_GUESSES, 96.9, true, true],
    [false, MAX_GUESSES, 100, false, false],
  ] as const)(
    'renders exactly those badges (solved=%s guesses=%s skill=%s)',
    (solved, guessesUsed, skill, hardMode, useHouseStarter) => {
      const score = scoreWith(solved, guessesUsed, skill);
      render(
        <ThemeProvider theme={theme}>
          <Results score={score} settings={{ hardMode, useHouseStarter, confirmed: true }} />
        </ThemeProvider>,
      );

      const chips = [...screen.getByTestId('badges').children].map((chip) => chip.textContent);
      expect(chips).toEqual(resultsBadges(score, { hardMode, useHouseStarter }));
    },
  );
});
