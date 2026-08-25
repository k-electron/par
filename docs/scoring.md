# How Par is scored

The implementation of spec §3, and what each constant trades. If you are looking
for the player-facing explanation, that lives in the results view; this is the
engineering account.

## The shape of a score

```
Total = Skill + Outcome + (took the house starter ? EPSILON : 0)
```

Three parts, deliberately separate, because they answer different questions.
**Skill** asks how well you played. **Outcome** asks how it turned out. The
**bonus** asks whether you took the shared bet. Keeping them apart is what lets
luck live in exactly one place.

## Skill

Every guess from the second onward is graded against the best play available in
that exact position:

```
s_i = 100 × Q(best legal guess, S_i) / Q(actual guess, S_i)
```

`Q(g, S)` is the expected total number of guesses to finish if you play `g` now
and continue optimally. `S_i` is the set of **answer-list** words still
consistent with everything revealed before guess `i`.

Three things about this are load-bearing.

**It is a ratio, not a difference.** The raw scale of "expected guesses lost"
varies enormously between the opening and the endgame, so a difference would not
be comparable across positions and 100 would not be reachable everywhere. A
ratio against the best available play means every position offers a real shot at
a perfect mark.

**It cannot see what happened.** `scoreGuess(history, guess)` takes no answer and
no resulting pattern. That is not a convention, it is the signature: a function
that cannot be told the outcome cannot let the outcome change a score.

**It never names the best word.** The return type carries a score, a luck figure
and a forced flag. The argmin exists inside the search and is never returned, so
no UI can leak what it was never handed.

Guesses are averaged weighted by `log2 |S_i|`:

```
Skill = Σ_{i ≥ 2, |S_i| ≥ 2} w_i · s_i / Σ w_i        w_i = log2 |S_i|
        (Skill = 100 if there are no such guesses)
```

A misstep with three hundred possibilities alive costs far more than one in a
forced endgame, so they should not count equally. Log-weighting also neutralises
hard-mode inflation, where late moves are frequently forced and would otherwise
pad a score with automatic full marks — a singleton position weighs `log2 1 = 0`
and cannot move the average at all.

**Guess 1 is never scored, under either opener path.** Opener choice expresses
itself only through the position it creates, which the outcome term prices at
fair odds. Scoring it as well would punish the bold random opener twice, and that
opener is a legitimate gamble rather than an exploit.

## Outcome

```
Outcome = C_PAR × (PAR − min(n, 7))
```

An unsolved game counts as seven guesses. This conversion happens in exactly one
function, `outcomePoints`, and that is a requirement rather than tidiness: **the
term has to stay linear in guess count.**

Linearity is the whole justification for rewarding luck at all. Under a linear
payout, minimising expected guesses and maximising expected points are the same
objective, so a gamble can win you a day but never a season. The moment the curve
bends upward — a jackpot for finishing in two — you are paying for variance
itself, and variance is free: anyone can manufacture it by guessing recklessly.
That converts a skill game into a lottery.

Fast finishes get badges. Never points.

## The luck figure

Alongside each guess, the results view shows realized information minus expected
information, in bits. Positive means the feedback broke better than the guess had
any right to expect.

It is display only and never enters a total. It is also shown **for guess 1**,
where skill deliberately says nothing — "your random opener ran hot today" is the
honest explanation for a fast finish, and it is a description of what happened
rather than a grade on the choice.

Because it is an expectation, it averages to zero across every answer a guess
could face. There is a test for that.

## The progress light

Beside each guess, the results view shows one of three lights for how much of the
standing uncertainty that guess cleared away:

```
progress = log2(|S_i| / |S_i+1|) / log2(|S_i|)
```

Green at a half or more, amber at a quarter or more, red below that. Display
only, like the luck figure, and **it never prints `|S_i|`** — decision
[0003](decisions/0003-the-progress-light.md) has that argument.

**One ratio rather than three rules.** A light has to be sensitive to how far
into the round a guess came, to the proportion it cut, and to the count it cut;
dividing realized information by the information that was standing does all
three at once. The denominator shrinks with the field, so late narrowing counts
for more. The numerator is the proportion. And a fraction alone would rate
`3000 → 1500` and `2 → 1` alike, where against the uncertainty each faced the
first is a twelfth of the way home and the second is all of it.

**Bands by integer comparison.** `progress >= k / n` is exactly
`after^n <= before^(n - k)`, so a half is `after² <= before` and a quarter is
`after⁴ <= before³`. Both stay whole numbers well inside exact integer range, so
no band can straddle a floating-point boundary and word the same round
differently on two machines. `docs/determinism.md` governs scores; this extends
the same care to the light beside them, for nothing, because integers are free
here.

**A field already down to one word gets no light.** There was no uncertainty to
remove, so there is no progress to report. The aggregation reaches the same place
independently: such a row weighs `log2 1 = 0`, so whatever it scores it cannot
move the skill average either way. Lighting it red would put the only judgement
on screen against a row the score itself declines to count.

**It is not the luck figure in another hat.** Luck is realized minus expected —
how the tiles broke against what the guess could reasonably ask for. This is
realized over available — how much of the way to the answer the guess actually
got. The two correlate at 0.53, so they agree on direction and differ often
enough to be worth showing side by side.

Both of the properties the light rests on — that it discriminates, and that red
still covers small cuts rather than only meaning "no cut" — are facts about the
word lists rather than about the code, so they go stale when the lists are
regenerated. `npm run check-lights` measures them and exits non-zero if either
has lapsed.

## The constants

All three live in [`src/engine/config/constants.ts`](../src/engine/config/constants.ts)
with their trade-offs written beside them.

| constant | value | validated range |
| --- | --- | --- |
| `C_PAR` | 4 points per guess | [3, 5] |
| `EPSILON` | 3 point starter bonus | [2, 4] |
| `PAR` | generated | recompute with the lists |

`C_PAR` **is the knob that trades daily drama against long-run fidelity.** Raise
it and single days get spikier and luckier; lower it and skill dominates but
daily results flatten into sameness. If you change it, you are making that trade
— do it knowingly.

`EPSILON` is sized to cover the small gap between a player's favourite opener and
a random decent one. Too large and everyone takes the house starter and then
ignores it; too small and nobody takes it and the mechanism is decoration. The
validated window is wide on both sides, so it is not a delicate number.

`PAR` is a single global constant, **never per-mode.** Hard-mode players sit
slightly over par for equivalent decision quality and that is accepted:
inflating one mode's scores to compensate for its difficulty would muddy what the
number means. The share badge tells the reader which mode was played.

## Par, and why it is anchored to strong play

`PAR` is the mean guess count for **strong play opening from house starters** —
deliberately not average-human play. If par were the average result, half the
field would be under par on any given day and the phrase would mean nothing.
Anchoring it to strong play means going under par is an actual accomplishment.

Most players will be over par most days. That is the honest baseline, and the
results copy carries it lightly rather than scolding.

It is a constant offset that cancels when two people compare the same day, so a
stale value never makes the competition unfair — it just makes the golf framing
lie. Recompute it whenever the word lists change:

```bash
npm run compute-par -- --days 300
```

That writes `src/engine/config/par.generated.ts`. It also reports what the house
starter costs against a fixed strong opener, which is how philosophy position 9's
"about a tenth of a guess" claim stays a checked fact.

### What it measured for the shipped lists

Over 300 days against word lists `fc66685a12af`:

```
PAR (house starter) 3.7100
  from SLATE          3.4700
  starter costs     0.2400 guesses
unsolved            0
distribution        2: 5   3: 102   4: 169   5: 23   6: 1
```

**`PAR` is 3.71, not the 3.50 the spec quotes**, and that difference is worth
understanding rather than papering over. Three things push it up, all of them
consequences of choices recorded elsewhere:

- Our answer list holds 3,000 words. A larger answer pool is simply a harder
  game, and the spec's 3.50 was measured against different lists.
- Our starter pool's distinct-letter tail is thin, which
  [`docs/wordlists.md`](wordlists.md) sets out in full. Weaker starters cost
  guesses, and the 0.24-guess gap against a fixed strong opener is that cost
  showing up. It is also more than philosophy position 9's "roughly a tenth of a
  guess" — that estimate was made against a cleaner pool.
- The simulation's strong play is bounded to a handful of probes and candidates
  per move, so it is a shade weaker than true optimal play, which inflates the
  mean slightly.

Because `PAR` is a constant offset it cancels whenever two people compare the
same day, so a higher value never makes the competition unfair. It shifts
everybody's total by the same +0.84 points and keeps the golf framing honest for
these lists rather than for someone else's.

## Checking the incentives still point the right way

Philosophy position 5 names the ordering the design targets:

> house starter + play well > own opener + play well > house starter, then
> ignore it and play well

The first gap is the bonus doing its job. The second matters more: taking the
bonus and then reverting to a memorised word must be clearly the worst of the
three, or the bonus is free money.

```bash
npm run check-incentives -- --days 120
```

Exits non-zero if the ordering breaks. Worth running after changing the word
lists or either constant.

### What it measured for the shipped configuration

Over 120 days, with `C_PAR` 4 and `EPSILON` 3:

| strategy | mean total | mean guesses | mean skill |
| --- | --- | --- | --- |
| house starter + play well | 103.11 | 3.683 | 100.0 |
| own opener + play well | 100.16 | 3.667 | 100.0 |
| house starter, then revert | 91.29 | 4.250 | 90.4 |

Both gaps point the right way. The first is +2.94 points — essentially the bonus,
less the small amount the house starter costs in guesses, which is the mild tax
on a bookmark habit the design is aiming for. The second is +8.87, and it is
large because the scoring does most of that work unaided: a memorised word played
at guess two is priced against a position where clues already existed, so it
loses on skill and on guess count at once. The bonus only has to cover the first
gap.

Skill reads 100.0 for both strong-play rows because the simulation's best move
*is* the benchmark it is scored against. That is a property of the harness rather
than a finding — what these runs measure is the effect of guess count and the
bonus, not differences in decision quality.

## Hard mode

Hard mode changes **only the legal set** — for the player's guess and for the
benchmark it is measured against. Never the formula. A player forced into a coin
flip by the rules played perfectly and is told so: the breakdown labels the move
forced rather than silently reporting a 100 it looks like they earned.

This is structural rather than a rule to remember. One `Ruleset` instance is
threaded through both sides of every comparison, so there is no path by which the
player and the benchmark could be judged against different legal sets.

## Approximation, and where it is exact

Exhaustively minimising over the full dictionary at every node is too slow, so
the search ranks legal guesses by one-step expected information and explores only
the best few plus the live candidates:

| candidates | probes | candidate guesses |
| --- | --- | --- |
| more than 200 | 2 | 1 |
| 61 to 200 | 3 | 2 |
| 16 to 60 | 6 | 4 |
| 15 or fewer | 12 | 12 |

Applied at every recursion depth, with the two sets deduped preserving rank
order.

Two suites check it, and they cover different things. `exactness.test.ts` runs
against a fourteen-word fixture, where full brute force is tractable — every
position there is in the bottom band, so what it proves is that the bottom band
is exact. `bands.test.ts` runs on the real lists across days chosen so all four
bands are actually reached, comparing against a wider ladder: **exact agreement
at fifteen candidates or fewer, and under 1.5 skill points above that.**

That split matches what the specification asks for. Exact where precision is
visible, near-exact elsewhere — with "near" measured rather than assumed.

**Endgames are not searched at all, they are settled by argument.** With one
candidate left `V = 1`, and with two `V = 1.5`, because a candidate guess is
always legal and either order finishes in one or two turns. Any bucket of two or
fewer short-circuits on the same reasoning. This is not an approximation, and it
is what makes the specification's exact 100 and exact 75 exact rather than
nearly right — the numbers those checks pin come out of closed-form arithmetic,
not out of a search that happens to converge.

If a player's guess somehow evaluates better than the search's best, theirs
becomes the benchmark and the guess scores 100. With only two probes above 200
candidates the benchmark is genuinely approximate, so this fires in practice —
and it surfaces as a 100 rather than as a score above it.

Performance rests on one observation: because guess 1 is never scored, every
position ever scored has already been filtered to a few hundred candidates. The
working set is therefore dictionary × *current candidates*, not dictionary × *all
answers* — roughly 2.6 MB rather than the 39 MB a full guess-by-answer matrix would need, built once per game and reused,
since a candidate set only ever shrinks.

## What the player is told

The results view shows the three parts and a row per guess. The explainer behind it works through
the round on screen: what each guess scored and why, every scored guess's share of the skill
average, `C_PAR × (PAR − n)` with that round's own `n` in it, and the addition that produced the
total. It computes nothing — every figure is read off the `GameScore` above it — and it is handed a
structural subset of that score with the candidate counts removed, so decision
[0004](decisions/0004-the-explainer-works-your-own-round.md) holds by type rather than by care.

Each row also says *why* it scored what it did, which decision
[0005](decisions/0005-the-explainer-says-why.md) has the argument for. Three display-only fields
carry it, all read off the pattern histogram the luck figure is already computed from:

| field | what it is | what it answers |
| --- | --- | --- |
| `standing` | where the guess sat among the words still fitting, likeliest first | a bet, or a question |
| `likeliestOutcomeShare` | the guess's largest bucket over `\|S_i\|` | what the guess was risking |
| `outcomeShare` | `\|S_i+1\| / \|S_i\|` | what the tiles did with it |

All three are positions or ratios rather than counts, so decision
[0003](decisions/0003-the-progress-light.md) is untouched: a ratio between two counts fixes neither.
`outcomeShare` reaching `likeliestOutcomeShare` means the tiles came back the likeliest way, which is
also the least informative way — so such a row's luck can never be positive, and the copy says both
in one breath.

**`standing` is the answer list explained rather than hidden.** The pool is every *dictionary* word
consistent with the feedback so far, which is the pool as a player sees it, and the answer list is
simply its top slice by frequency — `tools/wordlists/build.py` ranks the dictionary by Zipf and cuts
at three thousand, so the two are one object seen from two sides. A guess is placed on that pool from
the likeliest down, which says why a real word was never a live answer without ever saying that it was
not one. The copy says *likely* rather than *common* throughout, naming frequency once in the lead and
then leaving it — decision [0005](decisions/0005-the-explainer-says-why.md) records why.

Only the slice carries an order, so a word from below it is placed in the middle of the unranked
tail, and the copy shows five coarse bands rather than a figure. Both are deliberate: an exact
position would dress an estimate up as a measurement and would let a reader find the cut. Decision
[0005](decisions/0005-the-explainer-says-why.md) has that argument, along with what a determined
reader can still assemble.

**A standing is not a skill score, and the copy actively separates them.** Over 35 real positions two
guesses deep with twenty or more answers alive, betting the commonest still-fitting word was the best
play available in **none** of them — it averages the `near best` band, not full marks. A word far
down the list is regularly the better play, which is this game's whole thesis stated as a
measurement. The rows where the two diverge therefore carry an explicit "even so" or "still", so no
reader reads a placement as the verdict on the play.

**One-step expected information is not used for any of this, and the reason is worth recording.** It
is the obvious candidate and it disagrees with the score: a guess can rank 432nd of 2,327 legal words
by information and still score 94.6%, because skill is a ratio of expected *turns to finish* under
continued optimal play and information is one move deep. The magnitude in every sentence therefore
comes from the skill score itself, restated as turns.

## Determinism

A shared result has to re-score to the identical number on someone else's
machine, or comparing scores means nothing. That gets its own document:
[`docs/determinism.md`](determinism.md).
