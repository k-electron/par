/**
 * Spec §5: everyone gets the same puzzle on the same day, without a server.
 *
 * The timezone tests are the point of this file. A puzzle that rolls over at
 * local midnight would silently give friends in different countries different
 * answers, which is the kind of bug nobody notices until scores stop being
 * comparable.
 */

import { describe, expect, it } from 'vitest';

import { answers, starters } from '../../src/data';
import {
  PUZZLE_EPOCH,
  PUZZLE_TIME_ZONE,
  civilDateAt,
  daysFromCivil,
  puzzleNumberAt,
} from '../../src/engine/daily/calendar';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const lists = { answers, starters };

describe('daysFromCivil', () => {
  it('places the Unix epoch at zero', () => {
    expect(daysFromCivil({ year: 1970, month: 1, day: 1 })).toBe(0);
  });

  it.each([
    [{ year: 1970, month: 1, day: 2 }, 1],
    [{ year: 1969, month: 12, day: 31 }, -1],
    [{ year: 2000, month: 3, day: 1 }, 11_017],
    [{ year: 2026, month: 1, day: 1 }, 20_454],
  ])('converts %o', (date, expected) => {
    expect(daysFromCivil(date)).toBe(expected);
  });

  it('counts leap days', () => {
    const before = daysFromCivil({ year: 2024, month: 2, day: 28 });
    const leapDay = daysFromCivil({ year: 2024, month: 2, day: 29 });
    expect(leapDay - before).toBe(1);
    expect(daysFromCivil({ year: 2024, month: 3, day: 1 }) - leapDay).toBe(1);
  });

  it('treats 1900 as a common year and 2000 as a leap year', () => {
    const feb28 = { year: 1900, month: 2, day: 28 } as const;
    expect(daysFromCivil({ year: 1900, month: 3, day: 1 }) - daysFromCivil(feb28)).toBe(1);
    expect(
      daysFromCivil({ year: 2000, month: 3, day: 1 }) - daysFromCivil({ year: 2000, month: 2, day: 28 }),
    ).toBe(2);
  });
});

describe('the day boundary is anchored, not local', () => {
  it('numbers the epoch day zero', () => {
    // Noon in the anchor zone, safely inside the day whatever the offset.
    expect(puzzleNumberAt(new Date('2026-01-01T17:00:00Z'))).toBe(0);
  });

  it('gives every timezone the same puzzle for one instant', () => {
    // 2026-06-15 18:00 UTC is 14:00 in New York, but already 2026-06-16 in
    // Auckland and Tokyo. Everyone must still be on the same puzzle, because
    // the answer depends on the anchor zone rather than the reader's.
    const instant = new Date('2026-06-15T18:00:00Z');
    const expected = puzzleNumberAt(instant);

    for (const zone of ['UTC', 'Pacific/Auckland', 'Asia/Tokyo', 'Europe/London', 'Pacific/Honolulu']) {
      const asSeenLocally = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(instant);

      // The local civil date genuinely differs across these zones...
      expect(typeof asSeenLocally).toBe('string');
      // ...but the puzzle does not, because it is derived from one instant.
      expect(puzzleNumberAt(instant)).toBe(expected);
      expect(drawPuzzle(puzzleNumberAt(instant), lists)).toEqual(drawPuzzle(expected, lists));
    }
  });

  it('rolls over at anchor-zone midnight, not UTC midnight', () => {
    // 04:59 UTC on 16 June is 00:59 in New York (EDT, UTC-4): already the 16th.
    // 03:59 UTC is 23:59 on the 15th there, so the puzzle must not have moved.
    const justBefore = puzzleNumberAt(new Date('2026-06-16T03:59:00Z'));
    const justAfter = puzzleNumberAt(new Date('2026-06-16T04:01:00Z'));
    expect(justAfter - justBefore).toBe(1);
  });

  it('advances exactly once per day across a daylight-saving transition', () => {
    // US DST began 2026-03-08. A naive fixed-offset implementation drifts here.
    const before = puzzleNumberAt(new Date('2026-03-07T17:00:00Z'));
    const after = puzzleNumberAt(new Date('2026-03-09T16:00:00Z'));
    expect(after - before).toBe(2);
  });

  it('reads the civil date in the anchor zone rather than UTC', () => {
    // 03:00 UTC on 1 January is still 22:00 on 31 December in New York.
    expect(civilDateAt(new Date('2026-01-01T03:00:00Z'))).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it('pins the anchor to a single zone', () => {
    expect(PUZZLE_TIME_ZONE).toBe('America/New_York');
    expect(daysFromCivil(PUZZLE_EPOCH)).toBe(daysFromCivil({ year: 2026, month: 1, day: 1 }));
  });

  it('rejects an invalid instant rather than inventing a puzzle', () => {
    expect(() => puzzleNumberAt(new Date('nonsense'))).toThrow(RangeError);
  });
});

describe('drawing the puzzle', () => {
  it('is stable for a given day', () => {
    expect(drawPuzzle(1234, lists)).toEqual(drawPuzzle(1234, lists));
  });

  it('draws words that are actually in the lists', () => {
    const answerSet = new Set(answers);
    const starterSet = new Set(starters);
    for (let day = 0; day < 750; day += 1) {
      const puzzle = drawPuzzle(day, lists);
      expect(answerSet.has(puzzle.answer)).toBe(true);
      expect(starterSet.has(puzzle.starter)).toBe(true);
    }
  });

  it('handles days before the epoch without crashing', () => {
    const puzzle = drawPuzzle(-500, lists);
    expect(answers).toContain(puzzle.answer);
    expect(starters).toContain(puzzle.starter);
  });

  it('draws the answer and the starter independently', () => {
    // If the two draws shared a mix, the gap between their indices would be
    // constant. Across a year it must not be.
    const gaps = new Set<number>();
    for (let day = 0; day < 365; day += 1) {
      const puzzle = drawPuzzle(day, lists);
      gaps.add(answers.indexOf(puzzle.answer) - starters.indexOf(puzzle.starter));
    }
    expect(gaps.size).toBeGreaterThan(300);
  });

  it('spreads answers over the list rather than clustering', () => {
    const drawn = new Set<string>();
    for (let day = 0; day < 500; day += 1) {
      drawn.add(drawPuzzle(day, lists).answer);
    }
    // Birthday-collision territory for 500 draws from 3,000 words is around 460
    // distinct; far below that would mean the mix is not spreading.
    expect(drawn.size).toBeGreaterThan(440);
  });

  it('reports when the starter happens to be the answer', () => {
    const collide = { answers: ['crane'], starters: ['crane'] };
    expect(drawPuzzle(7, collide).starterIsAnswer).toBe(true);
    expect(drawPuzzle(7, collide).answer).toBe('crane');
    expect(drawPuzzle(7, lists).starterIsAnswer).toBe(false);
  });

  it('refuses to draw from an empty list', () => {
    expect(() => drawPuzzle(1, { answers: [], starters })).toThrow(RangeError);
  });
});

describe('golden puzzles', () => {
  // Pinned against word-list version fc66685a12af. If the lists are
  // regenerated these change, which is exactly why share links carry the
  // version stamp. Regenerate deliberately, never to make this pass.
  it.each([
    [0, 'curly', 'clade'],
    [1, 'favor', 'helms'],
    [100, 'henry', 'risks'],
    [365, 'sammy', 'clone'],
  ])('day %i draws the same words everywhere', (day, answer, starter) => {
    const puzzle = drawPuzzle(day, lists);
    expect([puzzle.answer, puzzle.starter]).toEqual([answer, starter]);
  });
});
