# Build: "Par" — a competitively scorable Wordle variant

Build a production-grade single-page web app implementing the game described below.

This document specifies **requirements and outcomes**, not implementation. Architecture, file organization, libraries beyond the few constrained below, algorithms, and data structures are yours to choose. Where this document is exact — the scoring model, the constants, the word-list properties, the verified test vectors — it is exact because those values are the product of extensive design work and simulation. Treat them as fixed. Where it describes an outcome, use your judgment about how to achieve it.

---

## 1. The idea

Standard Wordle is hard to compete at because results are dominated by luck: whether your opening word happens to hit. This variant scores **decision quality** — what each guess was worth *before* the tiles flipped — and pays out luck at fair odds. Friends playing the same day get the same answer and the same optional shared starter word, so scores are comparable.

Three player-facing concepts:

1. **House starter** — each day has one shared starter word. Take it sight-unseen for a small bonus, or bring your own opener and forgo the bonus.
2. **Skill %** — every guess from #2 onward is graded against the best play available in that exact position. Getting lucky doesn't raise it; getting unlucky doesn't lower it.
3. **Par** — a golf-style outcome term. Finish under par, gain points. Luck lives here, and only here.

## 2. Scope

- **No backend, no database, no accounts, no analytics.** Fully client-side and static.
- **Security is not a concern** — this is for a small group of friends. Word lists ship as static assets and are visible in page source; fine. The only privacy requirement is spoiler-safety (§7).
- Not building: leaderboards, multiplayer sync, auth, telemetry.

**Constrained choices:** TypeScript, React, and **Material UI** for all UI components and theming. Static build deployable to Cloudflare Pages. Everything else is your call.

---

## 3. The scoring model (exact — this is the product)

### Game state

- `S_i` = the set of **answer-list** words consistent with all feedback before guess *i*. `S_1` is the entire answer list.
- `L_i` = the legal guesses at turn *i*: the whole guess dictionary in normal mode; in hard mode, only words satisfying all accumulated constraints.

### Value of a guess

A guess is valued by the expected total number of guesses to finish if you play it now and then continue optimally:

```
Q(g, S) = 1 + Σ_{p ≠ WIN}  (|S_p| / |S|) · V(S_p)      S_p = { w ∈ S : pattern(g, w) = p }

V(S)    = 1.0                        if |S| = 1
        = 1.5                        if |S| = 2     (a candidate guess is always legal)
        = min over legal g of Q(g, S)  otherwise

```

Three things the formulas above don't say, which you must handle:

- **Skip empty partitions.** Only iterate patterns that actually occur; `0 × V(∅)` must not produce NaN.
- **Exclude non-splitting guesses.** If a guess puts all of `S` into a single non-winning bucket, `Q` recurses on the same state forever. Treat such guesses as infinitely bad (never selectable). A cycle guard on the memo table is also wise.
- **Hard mode inside the recursion:** hypothetical continuations accumulate the constraints they would have generated. When evaluating a bucket, the legal set for deeper nodes reflects the feedback that produced that bucket, not just the constraints known at the real position.

### Per-guess skill score

```
s_i = 100 × Q(best legal guess, S_i) / Q(actual guess, S_i)

```

Scores land in (0, 100]; 100 is achievable at every step in both modes. If a player's guess somehow evaluates better than your search's best, treat theirs as best (score 100).

Guess 1 is not scored. When `|S_i| = 1`, guessing the remaining word scores 100 — but its aggregation weight is `log2(1) = 0`, so it contributes nothing to the average either way.

### Aggregation

```
Skill   = Σ_{i ≥ 2, |S_i| ≥ 2} w_i · s_i / Σ w_i      with w_i = log2 |S_i|
          (Skill = 100 if there are no such guesses)

Outcome = C_PAR × (PAR − min(n, 7))       n = guesses used; an unsolved game counts as 7

Total   = Skill + Outcome + (took the house starter ? EPSILON : 0)

```

### Constants

```
C_PAR   = 4       points per guess relative to par
EPSILON = 3       house-starter bonus
PAR     = 3.50    for the shipped word lists

```

Use these values. Incentives were validated across `C_PAR ∈ [3,5]` and `EPSILON ∈ [2,4]`, so if a value must move, staying inside those ranges is known-safe; going outside them isn't.

`PAR` is the mean guess count for **strong** play starting from house starters — deliberately not average-human play, so that "under par" means you played well rather than merely finished. It's a constant offset that cancels when comparing two players on the same day; its job is to keep totals near 100 and make the golf framing meaningful. Provide a way to recompute it (simulate a few hundred days) and rerun it whenever the word lists change. If the lists change substantially, also sanity-check that the incentive ordering in the philosophy doc still holds.

`PAR` is a single global constant — **not** per-mode. Hard-mode players will sit slightly over par for equivalent decision quality, and that's accepted: inflating one mode's scores to compensate for its difficulty would muddy what the number means. The share badge tells the reader which mode was played.

### Invariants that must hold

- **Guess 1 is never skill-scored, for either path.** Opener choice expresses itself only through the position it creates, which the Outcome term prices at fair odds. This is what makes a lucky custom opener legitimate rather than an exploit.
- **The Outcome term stays linear in guess count.** Linearity makes expected points a straight function of expected guesses, so luck is paid at exactly fair odds and no gamble beats good play on average. Celebrate fast finishes with a badge, never with points. Convert guess count to points in exactly one place so this can't drift.
- **Realized outcomes never feed Skill.** Skill is computed from pre-flip expectations only.
- **Hard mode changes only the legal set** — for both the player's guess and the benchmark it is compared against. Never the formula. A forced move therefore scores 100.
- **Never reveal the optimal word** or suggest a guess, at any point.

### Accuracy and speed

Exhaustively minimizing over the full dictionary at every node is too slow; approximation is expected and acceptable. The requirement is that scores are **exact where precision is visible** — small candidate sets, endgames — and near-exact elsewhere.

A configuration we validated as exact — it matched full brute force on every testable state and matched a wider search everywhere. Rank legal guesses by one-step expected information descending, then search only the top *k* probes plus the top *c* candidate words (words in `S`, which can win outright), applied at **every** recursion depth:


| candidate set size | probes *k* | candidates *c* |
| ------------------ | ---------- | -------------- |
| |S| > 200          | 2          | 1              |
| 60 < |S| ≤ 200     | 3          | 2              |
| 15 < |S| ≤ 60      | 6          | 4              |
| |S| ≤ 15           | 12         | 12             |


Dedupe the two sets, preserving rank order. Memoizing on the candidate set made a full game's scoring cheap. Use this, or something you can demonstrate is at least as good.

A useful fact for performance: because guess 1 is never scored, every position you ever score has already been filtered to (typically) a few hundred candidates. So while the guess side stays the full dictionary, the working set is dictionary × *current candidates*, not dictionary × *all answers* — you never need the full ~30 MB guess×answer pattern matrix, and shouldn't ship it to the client.

### Display-only luck stat

For each guess, show how the feedback broke relative to expectation (realized information minus expected information — positive means lucky). It's a talking point, not a score; it must never enter `Total`.

Do show it for guess 1 — "your random opener ran hot today" is exactly the kind of thing players want to see, and it's the honest explanation for a fast finish. Just never present it as a grade on the opener choice; it describes what happened, not how well they chose.

---

## 4. Word lists

Three lists, generated by a committed script, with the generated output committed too.


| list             | size         | contents                                                           |
| ---------------- | ------------ | ------------------------------------------------------------------ |
| guess dictionary | ~10k–13k+    | Scrabble-valid five-letter words — everything a player may type    |
| answer list      | ~3,000       | frequency-ranked common words, a subset of the dictionary          |
| starter pool     | ~5,000–6,000 | frequency-ranked subset of the dictionary, letter-filtered (below) |


Build from a Scrabble lexicon (Collins or TWL — strongly preferred, and larger) intersected with an English frequency ranking such as the `wordfreq` corpus. **The Scrabble intersection is also your proper-noun filter** — those lexicons exclude names, which removes the WAYNE/DUBAI junk that pure frequency lists leak.

Webster's `web2` is an acceptable fallback if no Scrabble list is available, but note the tradeoff: it's smaller (~10k five-letter words) *and* it contains proper nouns, so on that path you must add an explicit name filter — otherwise names leak into the answer list and starter pool, which breaks the "answers are words people know" requirement.

Required properties, asserted at build time:

- answer list ⊆ guess dictionary; starter pool ⊆ guess dictionary
- starter pool composition: approximately 90% of words have five distinct letters and approximately 10% have exactly one doubled letter (one pair, no other repeats). Words that fit neither bucket — two pairs, or any letter appearing three or more times — are excluded from the pool entirely. Target the 90/10 split within a percentage point or so; it needn't be exact.
- all lists lowercase, five letters, no duplicates

Derive a stable version identifier from the list contents; it participates in share links (§7).

---

## 5. Determinism

Two people playing on the same day must get the same puzzle, and a shared result must re-score to the identical number on someone else's machine. Both without a server.

- **Same puzzle:** the day's answer and starter are derived deterministically from the date, drawn independently. Anchor "the day" to a single fixed timezone so friends in different timezones share a puzzle rather than rolling over at different moments. US Eastern is a sensible default. Make it a **build-time constant, never a user setting** — if players could change it, they'd get different puzzles and the whole premise collapses. No `Math.random`, no ambient clock or locale inside the derivation.
- Answers repeating occasionally by chance is fine; don't build a no-repeat cycle.
- **Same score:** scoring must be bit-identical across browsers and machines. That means deterministic tie-breaking anywhere you rank or choose among guesses, stable iteration and accumulation order, and no dependence on `Map`/`Set` insertion accidents. This is the subtlest requirement in the project — if it's wrong, replay links quietly show different numbers than the sender saw, which defeats the point of competing. Guard it with golden-value tests.
- **Versioning:** stamp share payloads with the word-list version and a scorer version. On mismatch, show the replay with a clear notice rather than silently displaying a different number.
- If the day's starter ever equals the day's answer (roughly once-a-decade odds), let it stand — house-takers get a free one-shot. Just don't crash.

---

## 6. Gameplay and settings

Standard Wordle rules: six guesses, five letters, green/yellow/grey feedback with correct duplicate-letter handling. Words outside the dictionary are rejected without consuming a turn.

Two per-day settings:

- **Hard mode** — the same rules as today's Wordle: revealed greens must be reused in position, and revealed letters reused at least as many times as hinted.
- **Use the house starter** — when on, the day's shared starter is played automatically as guess 1 and earns the bonus. The bonus is for *accepting the blind commitment*, so it attaches only to this toggle: a player who declines it and then happens to type the same word as their own opener gets no bonus.

Required behavior around these:

- The player **confirms** their settings on each fresh day before play begins, with the toggles pre-filled from their remembered preferences — so a daily regular just clicks through. Preferences persist; the confirmed choice is frozen per day.
- Once confirmed, both toggles are **locked** for that day and visibly so, with an explanation available. They must stay locked across reloads. This isn't anti-cheat — it's what makes the commitment real. Being able to see the starter and then bail on the choice would turn a blind bet into a free look, which is the whole mechanic.
- The house starter word must not be discoverable in the UI until after confirmation — taking it is a blind commitment. (A determined person could dig it out of the page; that's acceptable, and not worth defending against.)
- Hard-mode legality applies from guess 2 onward, including when guess 1 was the house starter.

---

## 7. Sharing and replay

Sharing has two jobs that pull against each other: it must spoil nothing for someone who just reads it, and it must let a friend see exactly what you did.

- **The shared text is spoiler-free** — an emoji grid recognizable to any Wordle player, plus the score, plus badges. Never the words, never the answer. Badges cover both the factual (house starter used, hard mode on, solved or not) and the celebratory (a fast finish, a clean round). The celebratory ones are how a hole-in-one gets recognized — they are cosmetic by design and must carry no points.
- **It includes a link that encodes the player's exact path.** Opening it reconstructs the board, recomputes the score from scratch, and shows the full play-by-play: each guess, its skill score, and its luck. The recomputed total must match the sender's exactly.
- **The link must be opaque.** Guesses and answer must not be readable from the URL text — chat clients preview URLs, and nobody should be spoiled by glancing at one. Compact encoding of word indices is enough; light obfuscation on top is fine. This is spoiler-prevention, not security, and should be treated as such.
- **Spoiler gate:** if a recipient hasn't finished that day's puzzle themselves, warn them before revealing anything and let them back out. It's a confirmation, not a wall — someone who chooses to look gets straight in.
- Malformed or unrecognized links fail gracefully.

---

## 8. Persistence

Local storage only. What must work:

- An in-progress game survives a reload exactly — board, keyboard state, locked settings.
- Settings preferences are remembered across days, so the daily confirm is one click.
- Completed days are retained with their scores, powering a personal stats view: games played, average total, average skill, guess distribution. The average over time is the point — it's where skill separates from luck, since single days are meant to be spiky. Bound growth sensibly. (A streak counter is optional and low priority; this audience isn't chasing retention mechanics.)
- Storage being unavailable or full (private browsing, quota) degrades gracefully to in-memory play rather than breaking.
- Version your stored data and handle upgrading it.

---

## 9. Experience outcomes

- Feels like Wordle to play: familiar board, on-screen and physical keyboard, tile reveal, invalid-word feedback. Mobile-first, comfortable one-handed on a phone.
- The results view makes the score legible at a glance and rewarding to dig into: the total, then skill and par framed conversationally ("played at 94%", "1.5 under par"), then the per-guess breakdown. Tone is warm and never scolding — a bad guess is priced, not criticized.
- A short, honest "how scoring works" explanation is reachable from results. Someone who has never heard of information theory should come away understanding why a probe can beat a guess.
- Accessible: keyboard-operable, screen-reader-announced feedback, colorblind-safe palette option, reduced-motion respected. Dark mode by default with a light option. Lean on MUI's theming rather than hand-rolling.
- Scoring feels instant. If computing a full game's score needs a moment, it must not block or freeze the interface — budget under two seconds on a mid-range phone, and cache results so revisiting a finished day is immediate.

---

## 10. Verification

The engine is the part that must be provably right; get it correct and tested before building UI on top of it. Required checks:

**Feedback — these exact cases are verified; your implementation must match all six:**


| guess | answer | result     |
| ----- | ------ | ---------- |
| SPEED | ABIDE  | ⬜⬜🟨⬜🟨    |
| SPEED | ERASE  | 🟨⬜🟨🟨⬜   |
| CRANE | CRANE  | 🟩🟩🟩🟩🟩 |
| AAAAA | ABOUT  | 🟩⬜⬜⬜⬜     |
| BANAL | ANNAL  | ⬜🟨🟩🟩🟩  |
| ANNAL | BANAL  | 🟨⬜🟩🟩🟩  |


**Scorer behavior:**

- one candidate left → guessing it scores 100
- a forced move (only one legal guess) scores 100
- **two candidates left → guessing a candidate scores 100, while a probe that distinguishes them but cannot win scores 75.** This one matters: it's the check that the scorer values *finishing*, not just information. If a probe and a candidate score equally here, the model is wrong.
- guess 1 contributes nothing to skill under either opener path
- hard mode never scores below what was legally achievable

**Determinism:** golden expected totals for a fixed set of games; identical answer and starter for a given date across simulated timezones; a shared link decoded and re-scored matches the original exactly.

**Payout shape:** points as a function of guess count are linear (constant differences).

**End to end:** confirm settings → play a full game → share → open the link in a clean browser profile → see the same board and the same total.

---

## 11. Deployment

- Static build, deployed to **Cloudflare Pages** via its native GitHub integration — pushes to the main branch deploy, pull requests get previews, and no deploy credentials live in CI.
- **GitHub Actions** runs the quality gate on pushes and PRs: type checking, linting, tests, and a production build. Red CI blocks nothing automatically, but it must be meaningful.
- No server runtime, no environment variables, no network calls at runtime.
- README covers connecting the repo to Cloudflare, regenerating the word lists, and recomputing `PAR`.

---

## 12. Incremental delivery

Do not attempt this in one pass. **Before writing code, propose a plan that breaks the work into a sequence of increments, and state it back to me for review.** You own the breakdown — what follows is what makes an increment good, plus the real dependencies that constrain ordering.

What each increment must be:

- **Coherently scoped** — it delivers one understandable thing, describable in a sentence without "and also". If the description needs a list, it's probably two increments.
- **Left in a working state** — at the end, the app builds, tests pass, and what exists runs. Never end an increment with half-wired code waiting on a future one to become functional.
- **Self-verifying** — it lands with the tests that prove the thing it added actually works, not a promise of tests later.
- **Independently valuable** — someone can look at it and see progress, whether that's a passing engine test suite or a playable board. Prefer thin vertical slices that work end-to-end over horizontal layers that don't do anything yet.
- **Reviewable in one sitting.** If it's sprawling, split it.
- **Explicit about exclusions** — say what you deliberately left out and which increment picks it up, so partial behavior is a known state rather than a mystery.

Real constraints on ordering, which fall out of the design rather than preference:

- The scoring engine's correctness gates everything that displays a number. Get it right and proven — including the §10 checks — before any UI depends on its output.
- Determinism protections (§5) belong with the code that computes scores, not retrofitted afterward. Retrofitting them means re-verifying everything built in between.
- The word lists gate `PAR`, which gates the outcome term, which gates any real score.
- Get the deploy pipeline working early, on something trivial. Every later increment is then verifiably shippable instead of accumulating deployment risk.

Between increments, tell me what landed, what you verified, and anything you learned that should change the plan. Adjusting the plan as you go is expected — silently drifting from it is not.

## 13. Priorities

When something has to give:

1. Correctness of the scoring model, exactly as specified in §3.
2. Cross-client determinism (§5) — silent divergence is worse than a visible bug.
3. Spoiler-safety of sharing (§7).
4. The daily loop feeling quick and pleasant (§6, §9).
5. Everything else.

