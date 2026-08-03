import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import type { Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The dependency rule in docs/architecture.md is only worth having if it
 * actually fails a build, so this suite runs ESLint over source that breaks it
 * and asserts a report comes back. Each fixture is linted under a virtual path
 * inside src/, which is how a file living in tests/ can be judged by the config
 * that governs src/engine or src/app/ui.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'boundaries');

const BOUNDARY_RULE = 'no-restricted-imports';

interface BoundaryCase {
  /** File under tests/fixtures/boundaries. */
  readonly fixture: string;
  /** Path inside src/ the fixture is judged as, relative to the repo root. */
  readonly lintedAs: string;
  /** What a reader should conclude when this case passes. */
  readonly proves: string;
}

const illegalCases: readonly BoundaryCase[] = [
  {
    fixture: 'engine-imports-app.ts',
    lintedAs: 'src/engine/score/aggregate.ts',
    proves: 'engine code cannot depend on app code',
  },
  {
    fixture: 'engine-imports-worker.ts',
    lintedAs: 'src/engine/score/aggregate.ts',
    proves: 'engine code cannot depend on the worker',
  },
  {
    fixture: 'engine-imports-data.ts',
    lintedAs: 'src/engine/words/filter.ts',
    proves: 'engine code cannot reach the word lists except through the Lexicon port',
  },
  {
    fixture: 'engine-reexports-app.ts',
    lintedAs: 'src/engine/score/aggregate.ts',
    proves: 'a re-export is caught as well as an import',
  },
  {
    fixture: 'ui-imports-engine-search.ts',
    lintedAs: 'src/app/ui/Results.tsx',
    proves: 'the UI cannot reach the search directly, only through app/scoring',
  },
];

const legalCases: readonly BoundaryCase[] = [
  {
    fixture: 'legal-engine-imports-engine.ts',
    lintedAs: 'src/engine/score/aggregate.ts',
    proves: 'the rule does not object to movement within the engine',
  },
  {
    fixture: 'legal-ui-imports-app-scoring.ts',
    lintedAs: 'src/app/ui/Results.tsx',
    proves: 'the sanctioned route from the UI to a score stays open',
  },
];

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function boundaryReports(testCase: BoundaryCase): Promise<Linter.LintMessage[]> {
  const source = await readFile(path.join(fixtureDir, testCase.fixture), 'utf8');
  const [result] = await eslint.lintText(source, {
    filePath: path.join(repoRoot, testCase.lintedAs),
    warnIgnored: false,
  });
  return (result?.messages ?? []).filter((message) => message.ruleId === BOUNDARY_RULE);
}

describe('the dependency rule', () => {
  it.each(illegalCases)('rejects $fixture, so $proves', async (testCase) => {
    const reports = await boundaryReports(testCase);

    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]?.severity).toBe(2);
    // The developer who trips this needs to be told where the rule is written
    // down, not merely that they tripped something.
    expect(reports[0]?.message).toContain('docs/architecture.md');
  });

  it.each(legalCases)('accepts $fixture, so $proves', async (testCase) => {
    expect(await boundaryReports(testCase)).toEqual([]);
  });
});

describe('the boundary fixtures', () => {
  it('stay out of the ordinary lint run, which would otherwise never pass', async () => {
    const ignored = await Promise.all(
      [...illegalCases, ...legalCases].map((testCase) =>
        eslint.isPathIgnored(path.join(fixtureDir, testCase.fixture)),
      ),
    );

    expect(ignored).toEqual(ignored.map(() => true));
  });
});
