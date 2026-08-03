/**
 * One number, one home.
 *
 * This replaces a test that policed a single constant. Policing one variable is
 * the same mistake one level up: the risk is not that `C_PAR` in particular gets
 * copied, it is that *any* number with a canonical home gets retyped somewhere
 * else and the two drift apart. Both real instances found so far were exactly
 * that — `parPhrase` retyping the unsolved floor as `7`, and the board carrying
 * its own `MAX_GUESSES = 6` so the rows it drew and the buckets the stats
 * histogram allocated were free to disagree.
 *
 * Two rules, both general:
 *
 * 1. No constant is declared in two places.
 * 2. In the logic layers, a canonical value does not appear as a bare literal
 *    outside the file that defines it.
 *
 * Rule 2 carries an allowlist, and every entry states why. An allowlist entry is
 * a claim that a number's resemblance to a constant is a coincidence — which is
 * sometimes true, and should have to be argued in writing.
 *
 * The UI is deliberately out of scope: `sx={{ gap: 6 }}` is a visual decision
 * that happens to be a six, and scanning it would produce noise that trains
 * people to add allowlist entries without reading them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ALL_SOURCES = globSync(['src/**/*.ts', 'src/**/*.tsx'], { cwd: ROOT })
  .filter((file) => !file.endsWith('.generated.ts'))
  .sort();

/** Where a number carries meaning rather than pixels. */
const LOGIC_SOURCES = ALL_SOURCES.filter(
  (file) =>
    file.startsWith('src/engine/') ||
    file.startsWith('src/app/state/') ||
    file.startsWith('src/app/share/') ||
    file.startsWith('src/app/scoring/') ||
    file.startsWith('src/app/storage/') ||
    file.startsWith('src/worker/'),
);

/**
 * Source with comments blanked out but the line structure intact.
 *
 * Deleting comments outright shifts every line after a block comment, so the
 * reported locations point at innocent code — which is worse than not reporting
 * a location at all, because it sends the reader somewhere plausible.
 */
function code(file: string): string {
  return readFileSync(resolve(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/** Lines of `file` where `value` appears as a standalone number. */
function bareLiteralLines(file: string, value: number): number[] {
  // Not part of a longer number, a decimal, or an identifier.
  const pattern = new RegExp(`(?<![\\w.$\\d])${value}(?![\\w.\\d])`);
  return code(file)
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

describe('no constant is declared twice', () => {
  it('gives every exported constant exactly one home', () => {
    const homes = new Map<string, string[]>();

    for (const file of ALL_SOURCES) {
      for (const match of code(file).matchAll(/export const ([A-Z][A-Z0-9_]*)\s*[:=]/g)) {
        const name = match[1]!;
        homes.set(name, [...(homes.get(name) ?? []), file]);
      }
    }

    const duplicated = [...homes.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name} declared in ${files.join(' and ')}`);

    // Re-exporting is fine and encouraged: `export { MAX_GUESSES }` does not
    // match the pattern above, because it declares nothing.
    expect(duplicated).toEqual([]);
  });
});

/**
 * Values with a canonical home, and the files allowed to contain them anyway.
 *
 * Every exception carries its reason. If a new one is needed, write the reason
 * first — if it cannot be written, the number probably wants the constant.
 */
const CANONICAL: readonly {
  readonly name: string;
  readonly value: number;
  readonly home: string;
  readonly allowed?: Readonly<Record<string, string>>;
}[] = [
  {
    name: 'WORD_LENGTH',
    value: 5,
    home: 'src/engine/words/letters.ts',
    allowed: {
      'src/app/share/codec.ts':
        'A shift width in the payload masking keystream, unrelated to word length.',
      'src/engine/daily/calendar.ts':
        'A divisor in the days-from-civil formula, which is calendar arithmetic.',
    },
  },
  {
    name: 'MAX_GUESSES',
    value: 6,
    home: 'src/engine/config/constants.ts',
    allowed: {
      'src/engine/search/policy.ts':
        'A probe budget in the spec search table that coincidentally equals six.',
      'src/app/share/codec.ts':
        'Base64 shifts by six bits, and two field widths that happen to be six.',
    },
  },
  {
    name: 'UNSOLVED_GUESSES',
    value: 7,
    home: 'src/engine/config/constants.ts',
    allowed: {
      'src/app/share/codec.ts':
        'A three-bit mask in the bit reader, which is written as the number seven.',
    },
  },
  {
    name: 'ALPHABET_SIZE',
    value: 26,
    home: 'src/engine/words/letters.ts',
  },
  {
    name: 'PATTERN_COUNT',
    value: 243,
    home: 'src/engine/words/pattern.ts',
  },
  {
    name: 'WIN_PATTERN',
    value: 242,
    home: 'src/engine/words/pattern.ts',
  },
];

describe('canonical values are not retyped', () => {
  it.each(CANONICAL)('$name ($value) lives only in $home', ({ value, home, allowed = {} }) => {
    const offenders = LOGIC_SOURCES.filter(
      (file) => file !== home && !(file in allowed) && bareLiteralLines(file, value).length > 0,
    ).map((file) => `${file}:${bareLiteralLines(file, value).join(',')}`);

    expect(offenders).toEqual([]);
  });

  it('states a reason for every exception', () => {
    for (const { name, allowed = {} } of CANONICAL) {
      for (const [file, reason] of Object.entries(allowed)) {
        expect(reason.length, `${name} exempts ${file} without a reason`).toBeGreaterThan(14);
      }
    }
  });

  it('has no stale exceptions', () => {
    // An allowlist entry for a file that no longer contains the literal is a
    // licence nobody is using, and it will quietly cover a future mistake.
    const stale = CANONICAL.flatMap(({ name, value, allowed = {} }) =>
      Object.keys(allowed)
        .filter((file) => bareLiteralLines(file, value).length === 0)
        .map((file) => `${name} still exempts ${file}`),
    );

    expect(stale).toEqual([]);
  });
});

describe('storage keys have one home', () => {
  it('builds every key from the namespace and schema version', () => {
    // A key typed out by hand somewhere else would read or write the wrong
    // place after a schema bump, silently losing somebody's history.
    const offenders = ALL_SOURCES.filter(
      (file) => file !== 'src/app/storage/repository.ts' && /['"`]par:v\d/.test(code(file)),
    );

    expect(offenders).toEqual([]);
  });
});
