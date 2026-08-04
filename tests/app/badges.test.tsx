/**
 * What badges each surface shows, for every input that can change the answer.
 *
 * This is a characterisation test, not a specification. It was written against
 * the behaviour as it stood and snapshotted *before* the badge rules were
 * pulled into one place, so the refactor had something to be measured against.
 * A snapshot that moves means the refactor changed what a player sees, which
 * was the one thing it was not allowed to do.
 *
 * Two surfaces render the same three celebratory badges — the results view and
 * the shared text — and both are captured here, because a correct rule wired up
 * wrongly at one call site still ships a bug. Order is captured too: the chips
 * render as a row, so reordering them is visible even when the set is the same.
 *
 * The skill values straddle the clean-round threshold by less than a float can
 * comfortably hold. That is deliberate. The plausible way to break this refactor
 * is to round before comparing, or to write the boundary as `> 96.99`, and only
 * values that close catch either.
 */

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shareText } from '../../src/app/share/share';
import { theme } from '../../src/app/theme/theme';
import { Results } from '../../src/app/ui/Results';
import { WORD_LIST_VERSION } from '../../src/data';
import { MAX_GUESSES } from '../../src/engine/config/constants';
import type { GameScore, GuessBreakdown } from '../../src/engine/score/scoreGame';

afterEach(cleanup);

const SKILLS = [0.1, 50, 96.9, 96.99999999999999, 97, 97.00000000000001, 99, 100];

/**
 * A score with the three fields badge selection reads, and just enough
 * breakdown for the results table to render. Nothing here needs to be a game
 * that could actually happen — the point is to reach inputs a real game would
 * take a very long time to produce, particularly around the threshold.
 */
function scoreWith(solved: boolean, guessesUsed: number, skill: number): GameScore {
  const breakdown: GuessBreakdown[] = Array.from({ length: guessesUsed }, (_, index) => ({
    turn: index + 1,
    guess: 'crane',
    pattern: 0,
    candidateCount: 100,
    skill: index === 0 ? null : skill,
    weight: index === 0 ? 0 : 1,
    luck: 0,
    forced: false,
  }));

  return { skill, outcome: 0, starterBonus: 0, total: skill, guessesUsed, solved, breakdown };
}

/** The badge chips the results view renders, in the order it renders them. */
function resultsBadges(score: GameScore, hardMode: boolean, useHouseStarter: boolean): string {
  cleanup();
  render(
    <ThemeProvider theme={theme}>
      <Results score={score} settings={{ hardMode, useHouseStarter, confirmed: true }} />
    </ThemeProvider>,
  );
  return [...screen.getByTestId('badges').children].map((chip) => chip.textContent).join(' | ');
}

/** The badge line of the shared text, which sits third by construction. */
function sharedBadges(score: GameScore, hardMode: boolean, tookHouseStarter: boolean): string {
  const text = shareText({
    puzzleNumber: 214,
    score,
    hardMode,
    tookHouseStarter,
    guessIndices: Array.from({ length: score.guessesUsed }, () => 0),
    wordListVersion: WORD_LIST_VERSION,
    origin: 'https://example.test',
  });
  return text.split('\n')[2] ?? '';
}

describe('badge selection', () => {
  it('is unchanged across every input that can move it', () => {
    const rows: string[] = [];

    for (const solved of [true, false]) {
      for (let guessesUsed = 1; guessesUsed <= MAX_GUESSES; guessesUsed += 1) {
        for (const skill of SKILLS) {
          for (const hardMode of [false, true]) {
            for (const useHouseStarter of [false, true]) {
              const score = scoreWith(solved, guessesUsed, skill);
              const key = [
                solved ? 'won ' : 'lost',
                `${guessesUsed}/${MAX_GUESSES}`,
                `skill=${String(skill).padEnd(18)}`,
                hardMode ? 'hard  ' : 'normal',
                useHouseStarter ? 'house' : 'own  ',
              ].join(' ');

              rows.push(
                `${key}\n` +
                  `    results: ${resultsBadges(score, hardMode, useHouseStarter)}\n` +
                  `    shared : ${sharedBadges(score, hardMode, useHouseStarter)}`,
              );
            }
          }
        }
      }
    }

    expect(rows.length).toBe(2 * MAX_GUESSES * SKILLS.length * 2 * 2);
    expect(rows.join('\n')).toMatchSnapshot();
  });
});
