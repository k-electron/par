# 0003 — The results table lights each guess rather than counting the pool

Status: accepted. The spec never asked for candidate counts, so nothing is departed from — but the
results view printed them from the day it existed, and this records why it stopped, so the column is
not "improved" back into numbers.

## What was on screen

The per-guess table's second column reported the candidate set as two exact integers: the count the
guess left behind, with the count it started from as the caption. A row read `253` over `from 3000`.

Two things came with that, neither of them intended.

**The first row gave away the answer list's size, on every round ever played.** A guess played into
an empty history faces the whole list, so the caption under row 1 was always `from 3000`. That says
the answers are a curated three thousand rather than the 12,972 words the game accepts.

**Every other row was a membership oracle.** The guess and its pattern are both on screen, and the
guess dictionary ships in the bundle, so the set of dictionary words consistent with a row is
computable by anyone who cares. The number beside it said exactly how many of them are possible
answers.

And `docs/philosophy.md` had assumed otherwise all along. Its case for benchmarking against the
answer list rather than the dictionary rests on the pool being invisible:

> Using the answer pool is the only self-consistent choice, even though players can't see that pool.
> For a casual audience this is fine: people reason about "a normal word" intuitively and land in
> roughly the right place without ever enumerating it.

The column was the one place enumerating it. This restores an assumption the design was already
making.

**This is not secrecy.** Position 13 puts the lists in the bundle deliberately and rules out effort
spent hiding them; the decision framework's last question rules out complexity aimed at an adversary
who does not exist. Anyone who wants the answer list can still read it out of the page source. What
changed is that the ordinary results screen stops handing it over unprompted, which costs nothing.

## What replaces it

One light per row — green, amber or red — for how much of the standing uncertainty the guess cleared:

```
progress = log2(before / after) / log2(before)
```

Green at a half or more, amber at a quarter or more, red below. The header changed from `Words left`,
which promised a number, to `Progress`.

**One ratio rather than three rules.** A light has to be sensitive to three things at once: how far
into the round the guess came, the proportion of the field it cut, and the number of words it cut.
Dividing what a guess revealed by what was there to reveal does all three, because the denominator
is the round's own progress:

- A hundred words struck off a field of three thousand rates near nothing, which is right — the
  player is barely closer to the answer.
- One word struck off a field of two rates as everything, which is also right.
- `3000 → 1500` and `2 → 1` are both halvings, and a fraction alone would rate them alike. Against
  the uncertainty each faced, the first is a twelfth of the way home and the second is the whole of
  it.

**Two states beyond the three colours.** The winning guess reads `solved`. A guess that faced a
field already down to a single word gets **no light at all**: there was no uncertainty to remove, so
there is no progress to report. That is the same fact `scoreGuess` uses to score such a guess 100
with weight `log2 1 = 0`, and it matters for tone — lighting it red would read as a verdict on a
guess the scorer itself prices at nothing. It is not a rare case: `npm run check-lights -- --days 150`
puts it at 88 rows of 728, so it is the difference between a table that regularly scolds a blameless
row and one that never does.

That command is where every number below comes from, and it fails the build if the light stops
discriminating or if red hardens into a proof — both are claims about the word lists, so both go stale
when the lists are regenerated.

**Bands by integer comparison, never by logarithm.** `progress >= k / n` is exactly
`after^n <= before^(n - k)`, so a half is `after² <= before` and a quarter is `after⁴ <= before³`.
Both stay whole numbers well inside exact integer range. A band resting on a floating-point
comparison could word the same round differently on two machines, and a replay link is meant to read
identically for both friends holding it.

**Never colour alone.** Each light carries a phrase — `a big cut`, `a fair cut`, `little or nothing`,
`nothing left to cut`, `solved` — and the phrase is the signal rather than a caption on it. Roughly
one man in twelve cannot separate red from green, which is why the board ships a high-contrast tile
palette at all; a signal living only in hue would undo that. It also keeps the light legible next to
a board where green and yellow already mean something else entirely.

## Old links

**Nothing was needed to make them work, and that is worth writing down rather than rediscovering.**
A share link carries the puzzle number, the flags, the guess indices and two version stamps — never
a score and never a breakdown. Everything shown is recomputed on the reader's machine, and
`StoredScore` keeps only a four-field summary, so there is no stored figure to migrate and no link
that needs reissuing.

`SCORER_VERSION` stays at 1, which is the load-bearing part. Its documented bump list is `C_PAR`,
`EPSILON`, a regenerated `PAR`, or the aggregation and outcome terms — a display change is on none of
them, and bumping it would make every link already sent announce itself as scored by a different
version of Par.

`tests/app/share.test.tsx` opens a link minted at `e4e1210`, before this existed, frozen as a
literal rather than re-encoded: re-encoding would only prove the codec agrees with itself, where a
literal proves a link already sitting in somebody's chat history still opens, still recomputes the
same total, and now arrives with lights it was never sent.

## What it still gives away

**This narrows the channel; it does not close it, and "minor inferred leaking is fine" is a decision
rather than an oversight.**

A word still possible always eliminates itself when it fails — consistency is pattern replay and
`computePattern(w, w)` is always the winning pattern — so a guess that ruled nothing out was
provably never a possible answer. The old column said so outright by printing an unchanged count.
The red band does not: it spans a cut of nothing through a cut of just under a quarter, and 41 of its
102 rows had ruled nothing out. **So red is a 40% hint where the count was a proof**, and the unlit
rows say only what `guessNote` already says out loud with `Only one word left`.

Mining the answer list a word at a time from post-game elimination logic is, in any case, strictly
more work than opening the page source.

**Red does not contradict the row it sits on.** Of the 55 endgame red rows the check judges against
the whole dictionary, none asked for 90% or more of the best information available — so a red light
does not land on a guess that read the position well and got poor tiles. That case exists in
principle, and the unlit state removes the common version of it.

**Nor is it the luck figure in another hat.** The two correlate at 0.53: luck is realized minus
expected, how the tiles broke against what the guess could reasonably ask for, where this is realized
over available, how much of the way to the answer the guess actually got. They agree on direction and
differ often enough to be worth showing side by side.

## What it costs

**The endgame reads less sharply.** "2, from 9" told you precisely how tight the position was, and a
light does not. `guessNote` still says `Only one word left` where it matters most.

**A light needs a sentence of explanation where a count did not.** The scoring explainer carries it,
which spec §9 asks for anyway — and it has something worth saying: a perfectly good opener often
shows amber, because it does a great deal of work and still leaves most of the guessing to do.

**Three bands throw away detail the numbers had.** That is the trade: the detail they threw away is
exactly the part that was doing the leaking, and the coarse version still tells the round's story
down the column.

## Its relationship to #7

[#7](https://github.com/k-electron/par/pull/7) moved the column from reporting the pool a guess was
handed to reporting what it left behind, so a row described its own guess. That principle is
untouched, and is why the light measures `before → after` rather than the position going in. Only the
units changed.

## Reversing it

`progressLevel` and `PROGRESS` in [`src/app/copy/results.ts`](../../src/app/copy/results.ts) are the
whole of it, plus `ProgressLight` in `Results.tsx`. Return the counts from there and the old column is
back, along with the first row publishing the size of the answer list. `tests/app/results.test.tsx`
asserts that no digit reaches the column on a round won or lost, so it cannot come back by accident.
