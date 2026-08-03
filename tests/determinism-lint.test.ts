import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The engine must not call an implementation-defined transcendental, because the
 * logarithm ranks the guesses the search explores: two browsers disagreeing in
 * the last bit could search different guesses and report different scores from
 * the same game. Spec §5 makes that the subtlest requirement in the project.
 *
 * A rule nobody has tested is a rule nobody should trust, so this lints source
 * that breaks it on purpose and asserts an error comes back. Same shape as
 * tests/boundaries.test.ts: each fixture is judged under a virtual path inside
 * src/engine, which is how a file in tests/ is governed by the engine's config.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'numeric');

const DETERMINISM_RULES = new Set(['no-restricted-properties', 'no-restricted-syntax']);

interface NumericCase {
  readonly fixture: string;
  readonly proves: string;
}

const illegalCases: readonly NumericCase[] = [
  {
    fixture: 'engine-uses-math-log2.ts',
    proves: 'the engine cannot call Math.log2',
  },
  {
    fixture: 'engine-uses-math-log.ts',
    proves: 'routing around it through Math.log is caught too',
  },
  {
    fixture: 'engine-uses-math-pow.ts',
    proves: 'Math.pow is caught, since its precision is equally undefined',
  },
  {
    fixture: 'engine-uses-exponent-operator.ts',
    proves: 'the ** operator is caught, which is Math.pow spelled differently',
  },
];

const legalCase: NumericCase = {
  fixture: 'legal-engine-uses-private-log2.ts',
  proves: 'the engine own log2 and the exactly-rounded parts of Math stay allowed',
};

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function determinismReports(fixture: string): Promise<string[]> {
  const source = await readFile(path.join(fixtureDir, fixture), 'utf8');
  const [result] = await eslint.lintText(source, {
    // Judged as engine source. The rule is scoped to src/engine/**, so where the
    // file is pretending to live is the whole point.
    filePath: path.join(repoRoot, 'src/engine/search/rank.ts'),
    warnIgnored: false,
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId !== null && DETERMINISM_RULES.has(message.ruleId))
    .map((message) => message.message);
}

describe('the ban on implementation-defined arithmetic', () => {
  it.each(illegalCases)('rejects $fixture, so $proves', async ({ fixture }) => {
    const reports = await determinismReports(fixture);

    expect(reports.length).toBeGreaterThan(0);
    // Whoever trips this needs to be told where the reasoning is written down.
    expect(reports[0]).toContain('docs/determinism.md');
  });

  it(`accepts ${legalCase.fixture}, so ${legalCase.proves}`, async () => {
    expect(await determinismReports(legalCase.fixture)).toEqual([]);
  });

  it('covers the whole engine rather than one directory of it', async () => {
    const source = await readFile(path.join(fixtureDir, 'engine-uses-math-log2.ts'), 'utf8');

    for (const area of ['numeric', 'words', 'rules', 'search', 'score', 'daily', 'config']) {
      const [result] = await eslint.lintText(source, {
        filePath: path.join(repoRoot, `src/engine/${area}/anything.ts`),
        warnIgnored: false,
      });
      const reports = (result?.messages ?? []).filter(
        (message) => message.ruleId === 'no-restricted-properties',
      );

      expect(reports.length, `src/engine/${area} is not covered`).toBeGreaterThan(0);
    }
  });
});

describe('the engine as it actually stands', () => {
  it('contains no call to an implementation-defined transcendental', async () => {
    // The fixtures prove the rule bites; this proves the shipped engine passes
    // it, so the guarantee is about real source and not only about test files.
    const results = await eslint.lintFiles([path.join(repoRoot, 'src/engine')]);
    const offences = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId !== null && DETERMINISM_RULES.has(message.ruleId))
        .map((message) => `${result.filePath}: ${message.message}`),
    );

    expect(offences).toEqual([]);
  });
});
