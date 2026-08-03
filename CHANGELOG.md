# Changelog

A per-increment record of what landed and what was verified.

## Increment 1 — Scaffold, CI, and the deploy pipeline

The toolchain, the module skeleton and the deployment path, with no game in them. Deploy is proven
first on something trivial so that every later increment is verifiably shippable.

### Added

- Vite + React + TypeScript + Material UI, dark theme by default, showing a placeholder page.
- The module skeleton from `docs/architecture.md`, laid down as empty directories so the boundary
  exists before the code that has to respect it.
- The dependency rule as an ESLint flat-config rule: `src/engine/**` may not import `src/app/**`,
  `src/worker/**` or `src/data/**`, and `src/app/ui/**` may not import `src/engine/search/**`.
- `tests/boundaries.test.ts`, which runs ESLint over deliberately illegal fixtures and asserts the
  rule reports, with legal fixtures as controls.
- Vitest with jsdom and Testing Library, plus tests covering the dark theme default and the
  placeholder page's heading and landmark.
- A GitHub Actions quality gate running typecheck, lint, test and build on pushes to `main` and on
  every pull request.
- `public/_redirects` with the SPA fallback, and `.node-version` pinning the Node version read by
  both CI and Cloudflare Pages.
- `README.md`, including the step-by-step for connecting Cloudflare Pages, and
  `docs/architecture.md`.

### Verified

- `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` all pass, and CI runs all
  four.
- The dependency rule fails lint on a real illegal import in `src/engine/` and in `src/app/ui/`,
  reporting the message that points at `docs/architecture.md`.
- The boundary test fails when the rule is disabled, so the test is load-bearing rather than
  decorative.
- `dist/_redirects` survives the production build; CI asserts it.

### Notes

- TypeScript is pinned to 6.0.x. TypeScript 7 is released but `typescript-eslint` 8 declares a peer
  range of `>=4.8.4 <6.1.0`, so adopting 7 would mean no TypeScript linting at all.
- MUI 9 no longer accepts system props such as `alignItems` or `fontWeight` directly on components;
  they belong in `sx`.

### Not included

No game logic of any kind — no word lists, no feedback or pattern code, no scoring engine, no
board. No end-to-end tests, and no accessibility or theming work beyond the MUI dark theme default.
