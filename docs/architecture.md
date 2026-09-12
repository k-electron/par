# Architecture

Core concepts sit behind single boundaries, and invariants are enforced by module shape and type signatures.

## Module map

```
src/
  data/         generated word lists and version identifiers (no logic)
  engine/       pure TypeScript: no React, DOM, or browser globals
    numeric/    deterministic log2 and fixed-order accumulation
    words/      word encoding, feedback patterns, candidate filtering
    rules/      Ruleset: normal and hard legal-move definitions
    search/     entropy ranking, SearchPolicy, memoization, Q and V
    score/      per-guess skill, aggregation, outcome term, luck
    daily/      calendar mapping to daily puzzle answer and starter
    config/     tunable constants
  app/
    state/      game session store
    storage/    Storage port, adapters, versioned repository, migrations
    scoring/    ScoringClient, async facade over worker / direct scoring
    share/      ShareCodec and emoji grid generation
    copy/       player-facing copy and copy helpers
    theme/      MUI theme, palettes, and shared styles
    ui/         components
  worker/       web worker entry: engine, word lists, message protocol
tools/          list generator, compute-par, incentive simulation
```

## The dependency rule

Dependencies run strictly in one direction:

- `engine/` imports nothing from `app/`, `worker/`, or `data/`. The engine receives word lists through the injected **Lexicon** port instead of importing `src/data`, allowing tests to run against small fixtures.
- `app/ui/` never imports `engine/search/`. The UI accesses scoring exclusively through `app/scoring`.

The rule constrains `src/engine/**` and `src/app/ui/**`. `src/worker` is exempt because its role is to compose the engine with word lists and the scoring protocol.

Both constraints are enforced by ESLint (`eslint.config.js`) and verified by [`tests/boundaries.test.ts`](../tests/boundaries.test.ts) using intentional violation and control fixtures. The rule matches import specifiers so that any path crossing `src/app`, `src/worker`, or `src/data` is caught. Type-only imports are subject to the same constraint.

## Ports

Ports isolate components subject to variation. They resolve once at construction and are closed over, keeping inner loops monomorphic without per-iteration interface dispatch:

- **Lexicon** — Injects word lists into the engine, enabling fast tests with lightweight fixtures.
- **SearchPolicy** — Abstracts candidate ranking and *k*-selection (`top-k`, brute-force, or wide-*k* policies).
- **Ruleset** — Defines valid moves for normal and hard mode; player guesses and benchmarks share the same instance.
- **Storage** — Abstracts `localStorage` and in-memory persistence behind a versioned repository.
- **ShareCodec** — Versioned encode/decode functions for share URLs.
- **ScoringClient** — Async facade used by UI: Web Worker in the browser, direct call in tests.

Tunable constants (`src/engine/config/constants.ts`) are imported directly rather than through a port.

## Enforced Invariants

Key domain rules are enforced structurally via types and module boundaries:

- **Realized outcomes never feed skill.** `scoreGuess(history, guess)` accepts no answer or pattern parameter, making it impossible for outcome knowledge to bias skill calculation.
- **Never reveal the optimal word.** Search return types include score, luck, and forced-move status, but omit the argmin. The UI cannot expose what it never receives.
- **Single guess-to-points conversion.** `C_PAR` is referenced in exactly one function, validated by redundancy tests.
- **Hard mode changes only the legal move set.** The same `Ruleset` instance is threaded through both player and benchmark evaluations.
