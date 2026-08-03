// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * The architecture's dependency rule (docs/architecture.md) is enforced here,
 * matched against the import specifier rather than against a resolved module.
 * Matching the specifier means the rule bites on modules that do not exist
 * yet, which is what lets the boundary be enforced from the empty skeleton
 * onwards instead of arriving after the code it is meant to constrain.
 *
 * Any specifier reaching into src/app, src/worker or src/data has to cross a
 * path segment of that name, whether written relatively (`../../app/state/x`)
 * or from the root (`src/app/state/x`), so a segment-anchored pattern catches
 * every spelling. Type-only imports are not exempt: a type dependency is still
 * a dependency, and `allowTypeImports` defaults to false.
 *
 * tests/boundaries.test.ts proves both rules actually report.
 */
const ENGINE_IS_PURE = {
  regex: String.raw`(^|/)(app|worker|data)(/|$)`,
  message:
    'src/engine must not import from src/app, src/worker or src/data. The engine is pure ' +
    'TypeScript and receives word lists through the injected Lexicon port. See docs/architecture.md.',
};

const UI_GOES_THROUGH_SCORING = {
  regex: String.raw`(^|/)engine/search(/|$)`,
  message:
    'src/app/ui must not import src/engine/search. The UI reaches scoring only through ' +
    'app/scoring, so the search result the UI can see never carries the argmin. ' +
    'See docs/architecture.md.',
};

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    // Deliberately illegal source. Linting it here would fail every run; it is
    // linted on purpose, under a virtual src/ path, by tests/boundaries.test.ts.
    'tests/fixtures/**',
  ]),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },

  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  {
    // react-hooks 7 still ships its eslintrc configs at the top level; the flat
    // ones live under `configs.flat`.
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },

  {
    files: ['vite.config.ts', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ENGINE_IS_PURE] }],
    },
  },

  {
    files: ['src/app/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [UI_GOES_THROUGH_SCORING] }],
    },
  },
]);
