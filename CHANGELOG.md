# Changelog

What landed and what was verified, newest first. Increments 1 to 11 built the game; what came after
landed as pull requests against a live site.

## After launch — 4 August 2026

The site went up on Cloudflare Pages at [par-e7i.pages.dev](https://par-e7i.pages.dev). Everything
here landed afterwards, each behind a pull request and a green quality gate.

### Added

- **Confetti when you solve it** (PR_LINK). Forty CSS-animated pieces over a fixed,
  `pointer-events: none`, `aria-hidden` overlay in
  [`src/app/ui/Confetti.tsx`](src/app/ui/Confetti.tsx) — no canvas, no dependency, nothing a screen
  reader has to read past. It waits on the same `finished` flag the score does, so the celebration
  lands with the last tile rather than over a row still turning over, and it is skipped entirely
  under a reduced-motion preference. Only on your own board: a shared round is somebody else's win,
  and [`Replay.tsx`](src/app/ui/Replay.tsx) does not render it. The scatter is derived from each
  piece's index rather than drawn at random, because the screen re-renders while the score settles
  and redrawn random values would teleport the pieces mid-fall. Three tests hold the line — the
  confetti is absent mid-reveal and present after, absent on a loss, absent on a replayed link.

- **An icon.** There was none, so every tab, bookmark and home screen showed a blank sheet of paper.
  The mark is a flagstick on the green, which is also a P: the tile is one of the board's own, in the
  colour a correct letter lands on, and both colours are read out of the theme rather than typed near
  it. [`public/favicon.svg`](public/favicon.svg) is the mark, and `tools/icons/render.ts` rasterises
  the two files that cannot be vector — a three-size `favicon.ico`, for Safari before 17 and a Windows
  taskbar pin, and the 180 PNG an iOS home screen asks for, since it ignores `rel="icon"`. Each size
  is rendered from the vector at its own size rather than resampled from one large bitmap, because at
  16 pixels that difference is the whole icon: it is also why every coordinate in the mark is even, so
  that no straight edge lands on a half pixel and renders three blurred pixels wide instead of two
  crisp ones. Like the word lists, the generator needs a browser, is run deliberately, and its output
  is committed.
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

- **The guess-by-guess table shows its three measures instead of narrating them.** Every row carried
  two lines of prose — a note under the word and a note under the luck figure — and the note under
  the word was mostly the skill number restated in bands: `Best available` at 99, `Near best` at 90,
  `Reasonable` at 70. So a six-row round spent twelve lines saying what four columns already said,
  and the reader had to parse a sentence per cell to compare two turns. The words are all still
  rendered, off-screen, so a screen reader reads exactly what the page used to print.
  - **Progress** is four pips rather than one dot with a phrase under it. The count carries the
    ordering, which the colour could not: `solved` and `major` are both green, so hue was always
    coarser than the bands `progressLevel` computes. Still a band and never a count of words —
    [0003](docs/decisions/0003-the-progress-light.md) is otherwise untouched.
  - **Skill** is a bar over the range a guess can actually reach, 50 to 100, with the exact figure
    still under it. `skill` is `100 × best/cost`, a ratio of expected guesses, so it cannot reach
    zero — and across 120 puzzles at three player strengths, about a thousand scored rows, nothing
    came in below 50. A 0–100 track therefore spent half its width on scores that cannot happen and
    drew 95 and 100 almost identically, which is where most rows land. 50 is where a whole turn
    goes: `best 1.000, yours 2.000` is one word left and a guess that was not it, so the track now
    covers exactly the range from giving up a turn to giving up nothing. The truncation discloses
    itself through the figure beside the bar — the bar ranks the rows, the number says what they
    scored — and a score under the measured floor clamps to an empty track rather than a negative
    one. Banded on `guessNote`'s own thresholds, `NEAR_BEST` and a newly named `REASONABLE`, so the
    bar and the phrase it replaced cannot disagree about a row. The two cases that were never a
    band of the number are drawn rather than written: a forced move greys its fill, since the score
    was the position's doing and not the player's, and an unscored opener is outlined rather than
    filled — flooring the track means a row *at* the floor draws nothing, and a solid empty track
    would otherwise read the same as a row that was never measured.
  - **Luck** is a bar either side of a zero mark, full at two bits, so its sign is the first thing
    read. Amber for hot and blue for cold, deliberately not green and red: luck never reaches a
    total, and colouring it like a grade would make the one display-only figure look like the
    verdict on the round.
  - The `#` header now reads `Guess`. It labelled a column of words, which it had done since the
    note moved in underneath the word.

- **The explainer says why each guess scored what it did, instead of restating the formula.** Every
  scored row read `what the best available play needed from there, as a share of what THIEF needed`
  — a ratio of two invisible quantities, in the order the formula computes it, with the noun both
  sides share never appearing. Beside it, `the tiles revealed 1.7 halvings less than THIEF could
  expect`, where information is what is revealed and halvings are only what it is measured in. Each
  row now places the guess among the words that still fitted every clue, from the likeliest down, and
  then either says it was close to the quickest way home or prices the gap in turns, adding
  what the guess was risking where that is the story: `Its likeliest break would still have left
  about half the field standing. From there it was heading for about 15% more turns than the best
  play available.` The list is the answer list explained rather than hidden — the generator ranks the
  dictionary by frequency and cuts at three thousand, so "the answer list" and "the top slice of the
  words that still fit" are one object seen from two sides — and it is a place on that list rather
  than a yes or no because a guess falls outside the answers two ways: the tiles ruled it out, which
  the reader can see on their own board, or the list does not carry it, which they cannot.
  `could not have been the answer` would publish the second one word per round, which is 0003's
  enumeration arriving by another route. Five coarse bands rather than a figure, since only the top
  slice carries an order and a percentage would dress an estimate up as a measurement. Where a guess
  sat is emphatically **not** how well it played, and the copy separates the two: over 35 real
  positions two guesses deep, betting the commonest still-fitting word was the best play available in
  none of them, and on the round this came from a word well down the list scored 95.2% where betting
  the top of it would have scored 92.7%. So the lead says skill prefers neither a bet nor a question
  because it counts turns, and the two kinds of row where the axes diverge carry an explicit `even
  so` or `still`. The scale runs `was the likeliest word` to `was way below the likeliest words that
  still fitted`, and says *likely* rather than *common* — frequency is the mechanism and is named once
  in the lead, but on a row it reads as a claim about English rather than about the position. Every
  luck row now names its direction before explaining it, on a scale everybody already owns — `ran hot`,
  `ran warm`, `ran cool`, `ran cold`, sharing `luckNote`'s thresholds so the dialog and the table
  cannot disagree, and avoiding its second-person middle pair because `broke against you` is wrong
  above somebody else's replay. Luck is said as a size
  rather than in bits, since a bit is a halving and `2^-luck` is exactly how the field came out
  against what a guess like that usually leaves; where the tiles came back the likeliest way a guess
  could break, the row says so, because that is simultaneously the most probable outcome and the
  least informative one. Three display-only fields carry it — `wasCandidate`, `outcomeShare` and
  `likeliestOutcomeShare` — all read off the pattern histogram the luck figure was already computed
  from, so nothing new is searched. Two are ratios and one is a boolean, so
  [0003](docs/decisions/0003-the-progress-light.md) is untouched and 0004's structural guarantee
  still holds: strip the counts out of a score and the explanation is identical. One-step expected
  information was the obvious basis for all this and is not used, because it disagrees with the
  score — a guess can rank 432nd of 2,327 legal words by information and still score 94.6%, since
  skill is a ratio of expected turns to finish and information is one move deep.
  [Decision 0005](docs/decisions/0005-the-explainer-says-why.md) has the argument, including the
  coin-flip wording that a test correctly refused.
- **The scoring explainer works through the round it is opened from.** It taught the model in the
  abstract and left the reader to apply it, so a player looking at `86%`, `−1.2` and a `87.8` had to
  work out for themselves which sentence accounted for which figure — and that the `86` was a
  weighted average of three of their four guesses rather than a plain one. It now opens on the round
  itself: every guess with what its skill figure means and how the tiles broke against what that
  guess could expect, then each scored guess's share of the skill average and the average itself,
  then `C_PAR × (PAR − n)` with that round's own `n` in it, then the addition that produced the
  total. Nothing in it computes a score — every figure is read off the same `GameScore` the card
  above it uses, and the one piece of arithmetic is a share of the skill average — so a link minted
  months ago opens with an explanation it was never sent, and `SCORER_VERSION` stays at 1. The
  candidate counts [0003](docs/decisions/0003-the-progress-light.md) took off the table do not come
  back: the copy is handed a structural subset of the score with them removed, so it cannot print a
  count it never receives, and the weight that does survive is only ever shown as a share of the
  round's total, which is a ratio between two logarithms and fixes neither. Points read to two
  decimals where the card reads one, because parts rounded to a tenth sum to the wrong tenth about
  half the time and an explanation whose own addition looks broken is worse than none.
  [Decision 0004](docs/decisions/0004-the-explainer-works-your-own-round.md) has the argument.
- **The guess-by-guess table lights each guess instead of counting the pool.** It reported the
  candidate set as two exact integers, which handed over more than it meant to: the caption under row
  1 was the answer list's exact size on every round ever played, and every other row was an exact
  count of its words consistent with a guess and a pattern sitting on screen beside it.
  `docs/philosophy.md` had assumed the opposite all along, benchmarking against the answer list "even
  though players can't see that pool". Each row now carries one light — green, amber or red — for how
  much of the standing uncertainty the guess cleared, which is `log2(before / after) / log2(before)`.
  That one ratio is sensitive to all three things a light has to weigh: how far into the round the
  guess came, the proportion it cut, and the count it cut. A hundred words off a field of three
  thousand rates near nothing; one word off a field of two rates as everything. Bands are integer
  comparisons rather than logarithms, so two friends on the same replay link cannot be shown
  different words, and every light carries a phrase because roughly one man in twelve cannot separate
  red from green. A field already down to a single word gets no light at all, since there was no
  uncertainty to remove and such a row weighs nothing in the skill average either, so a red mark would
  be the only judgement on screen for a guess the score declines to count. `Words left` became
  `Progress`, #7's principle — a row describes its own guess — is untouched, and
  [decision 0003](docs/decisions/0003-the-progress-light.md) has the argument, including what the
  light still gives away and why that is accepted.
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

- **The finished page scrolled about 670px past its own last line.** Only after a round ended, which
  is when the results table exists. The table carries every phrase it stopped drawing in a visually
  hidden span, and those were written in `sx` rather than in CSS — `sx` is not CSS, it runs bare
  numbers through MUI's transforms, and the two that applied here disagree about what `1` means.
  `width: 1` and `height: 1` go through the sizing transform, which reads anything up to 1 as a
  *fraction*, so the intended one-pixel boxes were `100% × 100%`: eighteen viewport-sized,
  absolutely positioned spans hanging below the layout. (`m: -1` goes through the spacing scale
  instead and meant −8px, where the recipe wants −1px.) Every length in that object is a string now.
  Nothing rendering to a DOM without layout can see this — jsdom reports every rect as zero — so the
  guard is an end-to-end one, asserting the document scrolls no further than the body actually
  reaches. It was shown to fail, at 678px, by reverting the fix under it.


- **The dev server never scored a round.** Every finished game sat on "Working out your round…"
  forever, on `npm run dev` only — the built site was always fine, which is why nothing caught it and
  why `playwright.config.ts` runs against the build. `App` built its scoring worker in a `useState`
  initialiser and disposed of it in an effect cleanup, and `StrictMode` punishes that asymmetry in
  two ways at once: it double-invokes the initialiser, and it mounts, unmounts and remounts. The
  cleanup therefore ran once against the client React had kept, `dispose` terminated its worker,
  state survived the simulated remount, and from then on every request was posted into a dead thread
  behind a promise that could not settle. The worker is no longer torn down by the component that
  uses it, because teardown there bought nothing: `App` is the root, so the only thing that ever
  unmounts it is the page going away, which takes the worker with it. StrictMode still builds a
  spare client in development, which is never asked for anything — being wrong in that direction
  costs an idle thread, where being wrong in the other direction cost every score.
  `tests/app/scoringWorker.test.tsx` is new and is the gap that let this through: every other suite
  hands `App` a scorer of its own, so nothing had ever exercised the worker's lifecycle. It mounts
  inside the `StrictMode` the app actually ships, and its fake worker treats termination as death,
  so a request reaching a terminated worker presents as the hang it really was.
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

- **The progress column's rendering tests stopped recomputing the answer they were checking.** Three
  of them derived the expected band by calling `progressLevel` in the assertion — the component's own
  expression — so they passed whatever the bands turned out to be, and what they claimed was a
  function of the generated word lists. They now render a round assembled by hand, five rows landing
  in five different bands chosen in the test file and written out there. A column reading the wrong
  row's counts comes out in a different order; one reading the same row every time does not vary. The
  bands themselves are still checked against fixed counts in `describe('the progress light')`, and
  each new assertion was shown to fail by pinning the component to one band.
- **`scoreGame` now checks the ordering its test was named for.** `prices a loss below any solve`
  asserted only that the outcome equalled `outcomePoints(6, false)`, which is the line `scoreGame`
  runs — it could not have caught the floor being wrong. It compares a lost round against a solve
  that used all six guesses, which is the claim the unsolved floor actually exists to make.
- **The guess column is read as a cell rather than as the first `span` in the row.** That query
  encoded where the markup happened to put the word, and broke on a layout change that left every
  word exactly where it was.

- **The icon is checked as a file, not as a picture somebody looked at.** `tests/icons.test.ts` holds
  every file `index.html` names to existing, holds `public/` to carrying no icon nothing declares,
  and holds each raster to the sizes the head claims of it, down to every entry in the ICO being a
  whole PNG of its own size. It also parses the SVG as XML rather than as HTML, which is the
  difference that mattered: the generator originally pasted the mark into a page, and an HTML parser
  forgave a stray control byte an editor had left in the comment above it. The file rendered perfectly
  there and was a broken-image icon in every real tab. Rasterising through an `<img>` and awaiting
  `decode()` — which is how a browser consumes a favicon — makes that fail generation instead. All
  twelve guards were shown to report by breaking one thing at a time.
- **A green seam ran the height of the flag at 180 pixels.** The stem and the pennant were two shapes
  meeting at `x=14`, and adjacent shapes are antialiased separately, so wherever that edge fell
  between pixels neither of them covered it fully and the tile showed through. It was invisible at 16,
  32 and 48, where that edge lands on a whole pixel, and turned up only in the rendered 180. The flag
  is one outline now, and the test holds it to one shape.
- **The icons survive the build and are served as themselves.** `e2e/icons.spec.ts` fetches each one
  from a production build and compares the bytes with the file in `public/`. A status code could not
  settle it: `_redirects` answers 200 with the app's HTML for any unmatched path, so on the deployed
  site a missing icon does not 404 — it silently returns a web page, and the tab goes blank.
- **A link minted before the progress light opens with it.** `tests/app/share.test.tsx` holds a
  payload frozen at `e4e1210` as a literal rather than re-encoding one — re-encoding proves the codec
  agrees with itself, where a literal proves a link already in somebody's chat history still opens,
  still recomputes the same total, and now arrives with lights it was never sent. Nothing was needed
  to make that work: links carry guess indices and version stamps, never a score, and `StoredScore`
  keeps a four-field summary. `SCORER_VERSION` stays at 1, since a display change is on none of its
  documented bump reasons and bumping it would tell every reader their old links were scored by a
  different Par.
- **The light prints no digit**, on a round won or lost, asserted in the component test and again over
  every surviving count of six starting fields. Each band is checked to be a floor the cut genuinely
  reached, the light to improve only as a cut deepens, and the single-word field to stay unlit.
- **What the light still gives away was measured rather than assumed.** A new `npm run check-lights`
  plays 150 days of middling play — strong play settles too early to reach the interesting positions —
  and reports that 41 of 102 red rows had ruled nothing out, so red is a 40% hint where the old count
  was a proof. Of the 55 endgame red rows it judges against the whole dictionary, none asked for 90%
  or more of the best information available, so red does not land on a guess that read the position
  well; the 88 rows that weigh nothing in the skill average get no light rather than a red one; and the light
  correlates with the luck figure at 0.53, so it is not that column in another hat. It exits non-zero
  if the light stops discriminating or if red hardens into a proof, both being claims about the word
  lists rather than the code.
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
