# Par

Par is a daily five-letter word game that scores the quality of your decisions rather than the
luck of your outcomes. A conventional word game rewards you for how few guesses you took; Par
measures each guess against what was knowable when you made it.

**Play it at [par-e7i.pages.dev](https://par-e7i.pages.dev).**

**Status: complete and deployed.** The scoring engine is verified against the specification, and the daily loop runs end to end.

## Requirements

- **Node**: version pinned in [`.node-version`](.node-version). The app is a static bundle requiring no database, environment variables, or server runtime.
- **Python**: required only to regenerate word lists. Generated lists are committed.
- **Chromium / Playwright**: required only for end-to-end tests and rendering icon rasters.

## Getting started

```bash
npm ci        # install dependencies
npm run dev   # start dev server on http://localhost:5173
```

> **Scoring in dev vs production:** Gameplay works under `npm run dev`, but end-of-round scoring runs in an unbundled Web Worker and can be slow. To test scoring at full speed, run a production build:

```bash
npm run build
npm run preview   # serve built dist/ on http://localhost:4173
```

End-to-end tests (`npm run test:e2e`) also target a production build.

## Scripts

| Script              | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Vite dev server with hot module replacement                  |
| `npm run build`     | Typecheck, then emit static production bundle to `dist/`     |
| `npm run preview`   | Serve built `dist/` locally                                  |
| `npm run typecheck` | TypeScript check across `src/` and `tests/` (no emit)        |
| `npm run lint`      | ESLint, including architectural boundary rules               |
| `npm run test`      | Vitest unit and integration tests                            |
| `npm run test:watch`| Vitest in watch mode                                         |
| `npm run test:e2e`  | Playwright tests against a production build                  |

`typecheck`, `lint`, `test`, and `build` form the CI quality gate; `test:e2e` runs as a second job. Both run on every pull request and on pushes to `main`. Branches must be up to date with `main` and pass all checks before merging.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/spec.md`](docs/spec.md) | The build specification. Normative. |
| [`docs/philosophy.md`](docs/philosophy.md) | Design rationale governing judgement calls left open by the spec. |
| [`docs/scoring.md`](docs/scoring.md) | Scoring model, score meter zones, dynamic curve fitting, and trade-offs. |
| [`docs/determinism.md`](docs/determinism.md) | Cross-client bit-identical scoring determinism. Critical reading. |
| [`docs/wordlists.md`](docs/wordlists.md) | Word list sources, licensing, generation, and asserted properties. |
| [`docs/architecture.md`](docs/architecture.md) | Module map, ports, and invariants enforced by shape. |
| [`docs/decisions/`](docs/decisions) | Decision records for design choices. |
| [`CHANGELOG.md`](CHANGELOG.md) | Historical log of changes and verifications. |

## Layout and the dependency rule

Architectural invariants and module layout are detailed in [`docs/architecture.md`](docs/architecture.md). Dependencies run strictly one way:

- `src/engine/` imports nothing from `src/app/`, `src/worker/`, or `src/data/`.
- `src/app/ui/` never imports `src/engine/search/`; it accesses scoring through `src/app/scoring/`.

Enforced by ESLint and tested in `tests/boundaries.test.ts`.

## Regenerating the word lists

The word lists under [`src/data/`](src/data) are generated from Collins Scrabble Words 2019 intersected with `wordfreq`. To regenerate:

```bash
python3 -m pip install --target tools/wordlists/.pydeps -r tools/wordlists/requirements.txt
PYTHONPATH=tools/wordlists/.pydeps python3 tools/wordlists/build.py
```

The generator enforces all properties from spec §4 before emitting. Afterwards, run `npm test` and recompute `PAR`.

## Word selection (v1 and v2)

Par deterministically draws each day's puzzle from the puzzle number and a build-time salt:

- **Word selection v1 (Puzzles 0–259)**: Daily answers were chosen uniformly from the top 3,000 words by frequency ([`src/data/answers.generated.ts`](src/data/answers.generated.ts)).
- **Word selection v2 (Puzzle 260 onwards)**: Answers use weighted selection over an expanded candidate pool ([`src/data/answers_v2.generated.ts`](src/data/answers_v2.generated.ts), 9,570 words):
  - **The list**: All 12,972 valid five-letter CSW19 words minus simple 4-letter + 's' regular plurals. Words legitimately ending in 's' (e.g. `chaos`, `focus`, `glass`) are retained. Pure 3rd-person singular verbs ending in 's' are grouped at the end. Both blocks are frequency-sorted.
  - **Deterministic weighted draw**:
    - Tier 1 (top 2,500 words): weight 10 (~59.4% probability)
    - Tier 2 (next 2,500 words): weight 4 (~23.8% probability)
    - Tier 3 (next 2,500 words): weight 2 (~11.9% probability)
    - Tier 4 (remaining 2,070 words): weight 1 (~4.9% probability)
  - **House starters v2 (`starters_v2`)**: Drawn from top 5,000 words of `answers_v2` containing no triple letters (Philosophy §9). Every v2 starter is a legitimate answer candidate.
  - **Backward compatibility and Path A scoring**: Puzzles 0–259 and legacy share links use v1 selection and score against the legacy lexicon with unweighted search (`SCORER_VERSION_V1 = 1`, `PAR_V1 = 3.7100`). Puzzles 260+ use probability-weighted search (`SCORER_VERSION_V2 = 2`, `PAR_V2 = 3.9800`). Both eras reproduce bit-identical scores.

See [`docs/wordlists.md`](docs/wordlists.md) and [`docs/scoring.md`](docs/scoring.md) for details.

## When the puzzle rolls over

The day boundary is anchored to **US Eastern** (`America/New_York`), and puzzle 0 is **1 January 2026** ([`src/engine/daily/calendar.ts`](src/engine/daily/calendar.ts)).

The puzzle changes at midnight Eastern worldwide (05:00 UTC winter / 04:00 UTC summer). To move the anchor, change `PUZZLE_TIME_ZONE` (shifts date-to-puzzle mappings).

## Recomputing `PAR`

`PAR` is the mean guess count for strong play opening from house starters:

```bash
npm run compute-par -- --days 300      # writes src/engine/config/par.generated.ts (defaults to v2)
npm run compute-par -- --v1 --days 300 # recomputes legacy v1 PAR
npm run check-incentives -- --days 120 # confirms incentive direction (defaults to v2)
npm run check-incentives -- --v1 --days 120 # confirms v1 incentives
npm run check-lights -- --days 150     # confirms progress light sensitivity
npm run simulate-zones                 # validates 16,000+ game scenarios across dynamic score zones
```

Recomputing `PAR` updates golden score snapshots because the outcome term depends on it. Review the diff and run `npx vitest run -u`.

## Regenerating the icons

[`public/favicon.svg`](public/favicon.svg) is the source vector. Fallback rasters are generated using Playwright:

```bash
npx playwright install chromium
npm run render-icons             # writes public/favicon.ico and public/apple-touch-icon.png
```

Tests in `tests/icons.test.ts` assert file presence, valid XML, and theme palette agreement. `e2e/icons.spec.ts` verifies that production builds serve expected raster assets.

## Deploying to Cloudflare Pages

The app is fully static and connects directly to Cloudflare Pages via Git.

Branch protection on `main` ensures only tested, passing code is built and deployed.

Settings for Cloudflare Pages:

| Setting                 | Value                                                 |
| ----------------------- | ----------------------------------------------------- |
| Project name            | `par` (active deployment: `par-e7i.pages.dev`)        |
| Production branch       | `main`                                                |
| Framework preset        | `React (Vite)` or `None`                              |
| Build command           | `npm run build`                                       |
| Build output directory  | `dist`                                                |
| Root directory          | *(leave empty)*                                       |
| Environment variables   | *(none)*                                              |

- **Node version**: Cloudflare's build system reads [`.node-version`](.node-version) automatically.
- **SPA fallback**: [`public/_redirects`](public/_redirects) maps all routes to `index.html` with a 200 status.

## Toolchain notes

- **TypeScript pinned to 6.0.x**: `typescript-eslint` 8 requires `<6.1.0`. Update when upstream adds TypeScript 7 support.
- **MUI 9 system props**: System props (`alignItems`, `fontWeight`, `textAlign`) must be declared within `sx`.
