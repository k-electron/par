# Architecture

The arrangement below exists so that the concepts most likely to change each sit behind exactly one
boundary, and so that the rules the game must not break are enforced by module shape and type
signature rather than by anyone remembering to obey them.

As of increment 1 most of these directories are empty. They are laid down first, with the
dependency rule already enforced, so that the boundary is in place before the code that has to
respect it.

## Module map

```
src/
  data/         generated word lists and their version id, no logic
  engine/       pure TypeScript: no React, no DOM, no browser globals
    numeric/    deterministic log2 and fixed-order accumulation
    words/      word encoding, feedback pattern, candidate filtering
    rules/      Ruleset: the normal and hard legal-move sets
    search/     entropy ranking, SearchPolicy, memo, Q and V
    score/      per-guess skill, aggregation, outcome term, luck
    daily/      date to day index to answer and starter
    config/     the tunable constants
  app/
    state/      game session store
    storage/    Storage port, adapters, versioned repo, migrations
    scoring/    ScoringClient, the async facade over the worker
    share/      ShareCodec and the emoji grid
    copy/       every player-facing string
    theme/      MUI theme and palettes
    ui/         components
  worker/       worker entry, imports engine only
tools/          list generator, compute-par, incentive simulation
```

## The dependency rule

Dependencies run one way:

- `engine/` imports nothing from `app/`, `worker/` or `data/`. The engine is pure TypeScript. It
  receives word lists through the injected **Lexicon** port instead of importing `src/data`, which
  is what lets engine tests run against twenty-word fixtures rather than 13,019 words.
- `app/ui/` never imports `engine/search/`. The UI reaches scoring only through `app/scoring`.

Both directions are enforced by ESLint in [`../eslint.config.js`](../eslint.config.js), so a
violation fails `npm run lint` and therefore fails CI. The boundary cannot quietly erode.

The rule matches the **import specifier** rather than a resolved module path. That is a deliberate
choice: matching the specifier means the rule bites on modules that do not exist yet, which is what
allowed the boundary to be enforced from the empty skeleton onwards. Any import reaching into
`src/app`, `src/worker` or `src/data` has to cross a path segment of that name, however it is
written, so a segment-anchored pattern catches every spelling of it. Type-only imports are not
exempt, because a type dependency is still a dependency.

A rule nobody has tested is a rule nobody should trust, so
[`../tests/boundaries.test.ts`](../tests/boundaries.test.ts) runs ESLint over fixtures that break
the rule on purpose and asserts an error comes back. The fixtures live in `tests/fixtures/`, are
excluded from the production build and from the typecheck of shipped code, and are ignored by
ordinary lint runs; the test lints them under a virtual path inside `src/` so that the configuration
governing `src/engine` or `src/app/ui` is the configuration that judges them. Legal imports are
included as controls, so a rule that rejected everything would not pass.

## The seven ports

These carry the parts expected to move. Ports resolve once when a scoring run is constructed and
are then closed over, so the inner loops across the full guess dictionary stay monomorphic and no
interface dispatch happens per iteration. Abstraction stops at the setup boundary.

- **Lexicon** — the engine receives word lists as an injected object rather than importing
  `src/data`, so engine tests run against tiny fixtures.
- **SearchPolicy** — `k` selection and guess ranking behind one interface. The validated top-*k*
  configuration, a brute-force policy and a wider-*k* policy are three implementations of it, so
  proving exactness is a policy swap rather than a second parallel scorer.
- **Ruleset** — normal and hard mode as two objects answering "what is legal from here". The
  player's guess and the benchmark are handed the same instance.
- **ScoringConstants** — injected rather than imported, so the incentive simulation can sweep
  constants without editing source.
- **Storage** — a small port with a localStorage adapter and an in-memory adapter behind a
  versioned repository, which makes graceful degradation a constructor argument.
- **ShareCodec** — versioned encode and decode, so a future format can ship alongside a decoder for
  the old one.
- **ScoringClient** — the async facade the UI talks to: a worker in the browser, a direct call in
  tests.

## Four invariants enforced by shape

Each of these is a rule the game must not break, arranged so that breaking it is a type error or an
impossibility rather than a mistake someone has to avoid making.

- **Realized outcomes never feed skill.** `scoreGuess(candidates, guess, ruleset)` has no parameter
  for the answer or for the resulting pattern, so a realized outcome physically cannot reach it.
- **Never reveal the optimal word.** The search's public return type carries the score, the luck
  figure and whether the move was forced — not the argmin. The UI cannot leak what it is never
  handed, which is also why `app/ui` may not import `engine/search`.
- **One guess-count-to-points conversion.** `C_PAR` is referenced inside exactly one function,
  asserted by a test that scans for other references.
- **Hard mode changes only the legal set.** A single `Ruleset` instance is threaded through both
  sides of every comparison, making "same formula, different legal set" structural rather than a
  rule to remember.
