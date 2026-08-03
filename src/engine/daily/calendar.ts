/**
 * Turning an instant into "which day's puzzle is it".
 *
 * Two people in different timezones must get the same puzzle rather than
 * rolling over at different moments, so the day boundary is anchored to one
 * fixed zone (spec §5). The anchor is a build-time constant and deliberately
 * **not** a user setting: if players could change it they would get different
 * puzzles and the shared-score premise collapses.
 *
 * The derivation itself is pure integer arithmetic. `Intl` appears only to
 * convert an instant into a civil date in the anchor zone — that is an input to
 * the derivation, not part of it — and it is pinned to an explicit timezone and
 * an explicit calendar, so no ambient locale reaches the result.
 */

/** The zone that defines when the puzzle rolls over. Build-time constant. */
export const PUZZLE_TIME_ZONE = 'America/New_York';

/** Day zero. Puzzle numbering counts from here in {@link PUZZLE_TIME_ZONE}. */
export const PUZZLE_EPOCH = { year: 2026, month: 1, day: 1 } as const;

export interface CivilDate {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31. */
  readonly day: number;
}

/**
 * Days from 1970-01-01 for a proleptic Gregorian civil date.
 *
 * Howard Hinnant's `days_from_civil`, which is exact for every date in range
 * and uses no floating point beyond integer-valued division.
 */
export function daysFromCivil({ year, month, day }: CivilDate): number {
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

const CIVIL_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: PUZZLE_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  era: 'short',
});

/** The civil date at `instant`, as seen in the anchor zone. */
export function civilDateAt(instant: Date): CivilDate {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Cannot derive a puzzle date from an invalid Date.');
  }

  let year = Number.NaN;
  let month = Number.NaN;
  let day = Number.NaN;
  let beforeCommonEra = false;

  for (const part of CIVIL_DATE_FORMAT.formatToParts(instant)) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
    else if (part.type === 'era') beforeCommonEra = part.value.startsWith('B');
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new RangeError(`Could not read a civil date in ${PUZZLE_TIME_ZONE}.`);
  }

  // formatToParts reports years as positive with an era marker.
  return { year: beforeCommonEra ? 1 - year : year, month, day };
}

/**
 * The puzzle number at `instant`: 0 on the epoch day, 1 the next day.
 *
 * May be negative for instants before the epoch. Callers that index a word list
 * must handle that rather than assuming it is non-negative.
 */
export function puzzleNumberAt(instant: Date): number {
  return daysFromCivil(civilDateAt(instant)) - daysFromCivil(PUZZLE_EPOCH);
}
