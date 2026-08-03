# Changelog

A per-increment record of what landed and what was verified.

## Increment 11 — Appearance, accessibility, and end to end

### Added

- A light theme alongside the default dark one, and a colourblind-safe tile palette using orange and
  blue in place of green and yellow. Both remembered across reloads.
- Tile colours moved into the theme, so a palette swap needs no component to change.
- A reduced-motion preference honoured once on the MUI baseline rather than per animation.
- Playwright end-to-end coverage of the specification's own scenario, on desktop and phone
  viewports, wired into CI as a separate job.

### Verified

- The full round: confirm settings, play, share, open the link in a genuinely clean browser context,
  and see the same board and the same total. This is the check that makes shared scores mean
  anything.
- An in-progress game survives a reload with the settings still locked.
- A malformed link fails gracefully and offers a way through to today's puzzle.
- On a phone viewport, the whole board and the keyboard are in view without scrolling.
- Screen-reader output: each completed row is announced as its letters and their feedback, rejections
  are announced politely, keys carry what is known about their letter, and tile state lives in the
  markup rather than only in colour.

## Increment 10 — History and personal statistics

### Added

- Each finished day now stores its score, so the stats view never re-scores a year of games.
- A stats panel led by average total and average skill, with games played, solve rate, average
  guesses, guess distribution and streak alongside.
- Schema version 2, with an additive migration from version 1 that leaves the old keys in place so a
  downgrade loses nothing.

### Verified

- Streaks break on a gap in the calendar, not only on a loss.
- Averages cover every game; average guesses covers solved games only.
- A version 1 record is carried forward, older data never overwrites newer, and an unparseable
  record is skipped rather than guessed at.
- Retention is bounded to a year, oldest dropped first.

### Notes

The averages lead deliberately. A single day is meant to be spiky — that is what makes a lucky round
fun — so the honest measure of how somebody plays is their mean over time. Streak measures showing
up, not playing well, which is why it is not the headline.

## Increment 9 — Sharing and replay

### Added

- An opaque share payload carrying the day, the two settings and the guess indices. The answer is
  never encoded; it is derived from the day.
- Spoiler-free share text: an emoji grid, the score, and badges, with no word anywhere.
- A replay route that rebuilds the sender's board and recomputes their score from scratch.
- A spoiler gate for anybody who has not finished that day, and a notice when a link was built
  against different word lists.

### Verified

- Round-trips across every flag combination, one to six guesses, and the highest dictionary index.
- No five-letter dictionary word appears anywhere in the encoded payload, and no guess index is
  readable in it.
- Malformed, truncated and corrupted links all fail gracefully, and decoding never throws.
- A recomputed replay total equals the sender's exactly.

### Notes

The masking and checksum are spoiler-prevention and graceful failure, not security. Nobody is
attacking this, and the word lists are readable in the page source anyway.

## Increment 8 — The results view, scored off the main thread

### Added

- A `ScoringClient` facade with a worker-backed implementation and a direct one for tests.
- The results view: total, skill and par phrased conversationally, per-guess breakdown with skill and
  luck, and badges.
- `app/copy`, holding every player-facing phrase in one reviewable place.
- A plain-English explainer reachable from the results.

### Verified

- The worker's score equals what the engine computes directly.
- Forced moves read as forced rather than as a silent 100 the player appears to have earned.
- The copy never scolds and never points at a word the player did not play, checked across every
  branch of every phrase function.
- The breakdown lists exactly the guesses played.

### Notes

The explainer's worked example is invented for teaching and describes a position that cannot arise in
a real game, so it cannot be back-solved. Over par is the common case — par is anchored to strong
play — so that phrasing gets the same care as the celebratory one.

## Increment 7 — The daily settings gate

### Added

- A `Storage` port with localStorage and in-memory adapters behind a versioned repository.
- The daily settings confirmation, pre-filled from remembered preferences.
- Locked, explained settings chips once a day has begun.
- Hard-mode legality on the board, with a message naming the clue that was dropped.

### Verified

- The starter word appears nowhere before confirmation.
- The lock survives a reload, because it lives in the day record rather than component state — and a
  reload is exactly how somebody would escape a choice they regretted.
- The gate cannot be dismissed by Escape or a backdrop click.
- The whole app keeps playing against a storage backend that throws on every call.

## Increment 6 — The daily puzzle and a playable board

### Added

- A timezone-anchored day number and independent answer and starter draws, both pure integer maths.
- The board, both keyboards, tile reveal, and invalid words rejected without spending a turn.

### Verified

- One instant yields the same puzzle in every timezone, rollover happens at anchor-zone midnight, and
  the day advances exactly once across a daylight-saving transition.
- Games played to a win and to a loss, through the physical and on-screen keyboards.
- Golden puzzles pinned for specific days.

### Notes

Roughly 1.2% of answers double as first names — `henry`, `sammy`. The Scrabble intersection excludes
capitalised-only names as intended, but cannot exclude words that are simultaneously a name and a
real dictionary entry. Documented in `docs/wordlists.md` rather than fixed with a names list.

## Increment 5 — Whole-game scoring and PAR

### Added

- Skill aggregation weighted by `log2 |S_i|`, with guess 1 excluded under both opener paths.
- `outcomePoints`, the only place a guess count becomes points.
- The constants in one file with the trade-off each controls written beside it.
- `npm run compute-par` and `npm run check-incentives`.

### Verified

- The payout curve has constant differences, and an unsolved game is priced as seven guesses.
- `EPSILON` attaches to the toggle, not to typing the starter word.
- `Skill` is 100 when no guess qualified, so a two-guess solve cannot divide by zero.
- The three named parts still reconstruct the total exactly, so luck cannot have leaked in.
- Golden totals pinned; they move only when `PAR` is deliberately recomputed.

### Notes

`PAR` measured 3.71 for these lists rather than the 3.50 the specification quotes — a 3,000-word
answer pool and a thinner starter tail both cost guesses. It is a constant offset that cancels
between players on the same day. The incentive ordering was re-confirmed rather than inherited:
house-plus-play-well 103.11, own opener 100.16, take-the-bonus-then-revert 91.29.

A real bug surfaced here: averaging several exactly-100 scores can round to 100.00000000000003, which
is outside the specification's stated range and not a number to show anybody. The aggregate is
clamped.

## Increment 4 — The position scorer

### Added

- `Q` and `V` behind a `SearchPolicy` port, with the validated ladder, a brute-force policy and a
  wide policy as three implementations.
- The per-game pattern matrix, exact-key memoisation, and the deterministic numeric kernel.
- `docs/determinism.md`.

### Verified

- One candidate scores 100, a forced move scores 100, and with two candidates a candidate scores 100
  while a probe that separates them but cannot win scores exactly 75.
- The validated ladder agrees with brute force on every state small enough to check exhaustively.
- Results are bit-identical across repeated runs.

## Increment 3 — Feedback and legality

### Added

- Base-3 feedback patterns, candidate filtering, and the `Ruleset` port with normal and hard modes.

### Verified

- All six feedback vectors from the specification, exactly.
- Hard-mode legality, including that it applies from guess 2 onward when guess 1 was the house
  starter.

## Increment 2 — The word lists

### Added

- A committed Python generator building three lists from Collins CSW19 intersected with `wordfreq`.
- 12,972 guesses, 3,000 answers, 5,000 starters split 90/10, and a content-derived version id.
- `docs/wordlists.md`.

### Verified

- Every property in the specification's word-list section, re-asserted against the committed output
  because the generator does not run in CI.
- The version id matches what the committed lists actually hash to.

### Notes

Collins CSW19 alone satisfies the stated size range, so the four-lexicon union an earlier plan called
for was dropped — it added 47 words for four sources and four licensing positions. The starter pool's
distinct-letter tail is thin by arithmetic rather than by choice: only 5,701 five-distinct-letter
Collins words appear in the corpus at all. Documented with the available trade-offs.

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
