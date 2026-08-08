# Changelog

What landed and what was verified, newest first. Increments 1 to 11 built the game; what came after
landed as pull requests against a live site.

## After launch — 4 August 2026

The site went up on Cloudflare Pages at [par-e7i.pages.dev](https://par-e7i.pages.dev). Everything
here landed afterwards, each behind a pull request and a green quality gate.

### Added

- **Forwarding a round somebody sent you**
  ([#4](https://github.com/k-electron/par/pull/4)). The replay view now carries the share control in
  the slot it occupies on your own results. It re-encodes from the guesses and flags already in the
  payload, so the text and the link come out byte for byte identical to the sender's — the same
  round handed on, not a retelling that drifts each hop. Withheld on a version mismatch, since
  re-encoding stamps this build's word list and scorer over a board the notice above it says cannot
  be trusted.
- **A branch ruleset on `main`** ([#2](https://github.com/k-electron/par/pull/2)). Both CI jobs are
  required and pinned to the GitHub Actions app, and the branch must be up to date before it merges.
  Cloudflare builds the merged commit, so without that last part a pull request could be green
  against an older `main` and still deploy a tree nothing had tested.

### Changed

- **The field column shows the cut, not the count.** The guess-by-guess table reported the candidate
  set as two exact integers, which handed over more than it meant to: the caption under row 1 was the
  answer list's exact size on every round ever played, and every other row was an exact count of its
  words consistent with a guess and a pattern both sitting on screen beside it — a membership oracle
  against a dictionary that ships in the same bundle. `docs/philosophy.md` had assumed the opposite
  all along, benchmarking against the answer list "even though players can't see that pool". Each row
  now carries a bar for how much of the field its guess left standing and a phrase for how far the
  field fell, so `Words left` became `Field`. A ratio is the better read anyway: the old code conceded
  that 253 words means nothing without the 3,000 it came from. The bands are integer comparisons
  rather than logarithms, so two friends on the same replay link cannot be shown different words.
  #7's principle — a row describes its own guess — is untouched. This narrows the channel rather than
  closing it: a row that ruled nothing out still proves the guess was not a live candidate, because a
  live candidate always eliminates itself, and `Only one word left` says more than that outright.
  [Decision 0003](docs/decisions/0003-the-field-is-relative-not-counted.md) has both the argument and
  that accounting, measured.
- **The guess-by-guess table reports its own guess**
  ([#7](https://github.com/k-electron/par/pull/7)). The number column showed the pool a guess was
  handed, which is a fact about the guess before it — following a round meant reading every number a
  line late, and the last guess's effect appeared nowhere at all. It now leads with what the guess
  left behind, with the count it started from as the caption underneath.
- **The badge rules have one home** ([#5](https://github.com/k-electron/par/pull/5)). The three
  celebratory conditions were written out in full in both the results view and the shared text.
  `CLEAN_ROUND_SKILL` and `QUICK_ROUND_GUESSES` replace the bare literals, one predicate decides, and
  each surface renders through an exhaustive record so a fourth badge cannot compile until both have
  worded it. Widening the redundancy audit to `src/app/copy/` found a third copy of the threshold in
  `headline()`, where a round could have been badged clean while the sentence above it declined to
  say so.
- **`CODE_A` is exported rather than retyped** ([#5](https://github.com/k-electron/par/pull/5)). It
  was a private 97 in `letters.ts`, written out bare three times in `gameSession.ts` and twice in the
  search memo key in `constraints.ts`.

### Fixed

- **The replay board sat 83px left of centre**
  ([#3](https://github.com/k-electron/par/pull/3)). `Board` and `Keyboard` centre themselves with
  `mx: 'auto'`, and MUI's `Stack` resets every direct child's margin at a specificity that outranks
  the child's own class. `GameScreen` escaped it by accident, having a wrapper `Box` in the way;
  `Replay` did not. The theme now defaults `Stack` to `useFlexGap`, so spacing uses `gap` and child
  margins survive. The keyboard carried the same defect at 2px — invisible, and still wrong.
- **A replay captioned somebody else's board "Your round"**
  ([#4](https://github.com/k-electron/par/pull/4)), four lines below a header saying it was somebody
  else's. Every second-person phrase now bends with whose round is on screen.
- **Two README claims that had stopped being true**
  ([#2](https://github.com/k-electron/par/pull/2)): the repository is public rather than private, and
  the word-list licensing paragraph no longer rests its argument on the project being unpublished.

### Verified

- **The field column prints no digit**, on a round won or lost, asserted in the component test and
  again end to end against the production bundle, which is the artefact a player actually reads. Every
  bar is checked to be drawn at the field its own guess left standing, and each band phrase to be a
  floor the cut genuinely reached, across every surviving count of three starting fields.
- **What the column still gives away was measured rather than assumed**, over forty simulated rounds:
  22 rows in 171 where `nothing ruled out` proves a consistent guess is not an answer, against 29 rows
  where the older `Only one word left` caption proves as much or more. Decision 0003 records the
  mechanism, the numbers, and what closing it would cost.
- **The scorer is untouched.** `candidateCount` and `remainingCount` still reach the view; it simply
  declines to print them, so `SCORER_VERSION`, existing share links and the golden score snapshot all
  stand. The change is confined to `src/app/copy/` and `src/app/ui/`.
- **The bar reads in both themes**, checked against a real production build in dark and light — it is
  drawn from `divider` and `text.secondary` rather than from a colour of its own, so it follows the
  appearance setting and owes nothing to the tile palette.
- **No past share link changed.** The app was rebuilt at `f08e738`, served beside current `main`, and
  the same real link opened in both: identical total, board, badges, per-guess skill and luck, and
  summary figures. Diffing the entire rendered page found exactly three differences, all of them
  changes that were asked for.
- Forwarding a round produces text byte-identical to the sender's, asserted in a component test and
  again end to end against a production build.
- The badge refactor is neutral, established by a characterisation snapshot committed *before* any
  source change and proven first to fail against two deliberate regressions.
- `SCORER_VERSION` stays at 1 throughout. Nothing on its documented bump list changed, and bumping it
  would make every existing link report itself as scored by a different version of Par.

### Notes

The deploy is Cloudflare Pages' native Git integration, which builds `main` independently of GitHub
Actions and would ship a commit whose tests failed. Spec §11 forecloses the obvious alternative —
deploying from CI needs an API token that same section forbids — so the gate sits on the branch
instead. Recorded in [decision 0002](docs/decisions/0002-red-ci-blocks-the-merge.md), because it
departs from §11's "red CI blocks nothing automatically".

The 768-row snapshot that proved the badge refactor neutral was deleted once it had
([#6](https://github.com/k-electron/par/pull/6)). Its job was one refactor. As a standing test it was
1156 rows of which about eight carried information, and the realistic response to a failing diff that
size is to accept it wholesale — which is worse than no test, because it reads as coverage. Eight
named rules and one property replaced it.

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
