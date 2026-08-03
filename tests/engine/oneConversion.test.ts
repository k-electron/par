/**
 * Spec §3: "Convert guess count to points in exactly one place so this can't
 * drift."
 *
 * A behavioural test already asserts the payout curve has constant differences,
 * and that is the stronger guarantee — but it only holds for the path it
 * exercises. A second call site could price some other situation differently
 * and never show up as a bend in a curve someone remembered to measure. So this
 * one reads the source, which is the only way to check an "exactly one place"
 * claim.
 *
 * `PAR` is deliberately not policed here. The results view and the share text
 * both read it to say "1.5 strokes under par", which is describing a score
 * rather than computing one. What must stay in one place is the arithmetic that
 * turns a guess count into points: `C_PAR` and the unsolved floor.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFINITION = 'src/engine/config/constants.ts';
const CONVERSION = 'src/engine/score/scoreGame.ts';

/** Source with comments removed, so prose about a constant is not a use of it. */
function code(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/** Shipped source only. Tools and tests may quote a constant freely. */
const SHIPPED = globSync(['src/**/*.ts', 'src/**/*.tsx'], { cwd: ROOT }).sort();

function filesUsing(name: string): string[] {
  const pattern = new RegExp(`\\b${name}\\b`);
  return SHIPPED.filter((file) => file !== DEFINITION && pattern.test(code(file)));
}

describe('the guess-count-to-points conversion', () => {
  it.each(['C_PAR', 'UNSOLVED_GUESSES'])(
    'reads %s in exactly one shipped file besides its definition',
    (name) => {
      expect(filesUsing(name)).toEqual([CONVERSION]);
    },
  );

  it('reads C_PAR inside outcomePoints and nowhere else in that file', () => {
    const source = code(CONVERSION);

    // Once to import it, once to use it. A third would be a second conversion.
    expect(source.match(/\bC_PAR\b/g) ?? []).toHaveLength(2);
    expect(/export function outcomePoints\([^)]*\)[^{]*\{[^}]*\bC_PAR\b/s.test(source)).toBe(true);
  });

  it('finds the conversion where the module map says it is', () => {
    // Guards the documentation as much as the code: docs/scoring.md and
    // docs/architecture.md both name this function.
    expect(code(CONVERSION)).toMatch(/export function outcomePoints\(/);
  });
});
