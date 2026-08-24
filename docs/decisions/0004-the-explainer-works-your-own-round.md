# 0004 — The explainer works through the round in front of it

Status: accepted. Spec §9 asks for "a short, honest 'how scoring works' explanation" reachable from
results, and this is still that — but it now answers the question a player actually arrives with,
which is not how skill works but why *their* skill is 86.

## What was on screen

Six sections of general account: why a probe can beat a guess, what skill measures, what par is
anchored to, what the light means, what luck is, why the starter locks. All of it true, none of it
about the round the reader had just finished.

So the dialog explained the model and left the reader to apply it. A player looking at `86%`, `+2.8`
and a `92.3` on their card had to work out for themselves which sentence accounted for which figure,
that the `86` was a weighted average of two of their guesses rather than of all three, and that the
`92.3` was those two numbers plus a bonus. Every one of those is a short calculation, and every one
of them is a calculation we had already done.

## What replaces it

The general account, kept and tightened, with a walkthrough of the round above it:

- **Each guess in turn.** What its skill figure means — the guesses the best available play needed
  from that position, as a share of what the guess needed — or that it is an opener and is not
  scored. Then how the tiles broke against what that guess could expect, in halvings.
- **Skill.** Every scored guess with its score and its share of the average, then the average. This
  is the part that could not be inferred from the card: the weighting is by `log2 |S_i|`, so a
  reader who averages the skill column by hand gets a different number and concludes one of them is
  wrong.
- **Par.** `C_PAR × (PAR − n)` with the round's own `n` in it, and the unsolved floor named where it
  applies.
- **The bonus and the total**, as an addition that adds up.

Nothing here computes a score. Every figure is read off the `GameScore` the engine already
produced, and the only arithmetic is a share of the skill average, which is a weight the scorer
recorded divided by the sum of them. `SCORER_VERSION` stays at 1 — see *Old links* below.

## Why the counts still do not appear

[0003](0003-the-progress-light.md) took the candidate counts off the results table. Walking through
a round is exactly where they would come back, because "how much was still unknown" is what the
weighting is about.

They do not, and the guarantee is a type rather than a habit. `RoundToExplain` is a structural
subset of `GameScore` that omits `candidateCount` and `remainingCount`, so the copy module cannot
print a count it is never handed — the same shape of argument as `scoreGuess` not returning the
argmin. Two tests hold it: stripping the counts out of a score leaves the explanation identical, and
so does doubling every weight.

**`weight` does survive, and it is `log2 |S_i|`.** It is only ever shown as a share of the round's
total weight, and a ratio between two logarithms fixes neither of them: `64%` and `36%` say the
earlier position was about 1.8 times the later one in bits and nothing at all about either count.
A share of zero is the one exception, and it means a single-word field — which `guessNote` already
says out loud with `Only one word left`, and which the light already declines to grade.

## Two decimals, where the card shows one

The card rounds points to a tenth. The explainer shows two, and the reason is arithmetic rather than
precision: `86.4 + 2.8 + 3.0` is `92.2`, where the card says `92.3`. Parts rounded to a tenth sum to
the wrong tenth about half the time, and an explanation whose own addition looks broken is worse
than no explanation. Skill percentages are shown to a tenth for the same reason — the shares
multiplied out have to land on the figure above them.

`PAR` is printed with the digits it has rather than shortened to two, because the multiplication is
printed beside it: a reader who multiplies `4 × (3.71 − 3)` must get the `+2.84` on screen.

## Old links

**Nothing was needed to make them work.** A share link carries the puzzle number, the flags, the
guess indices and two version stamps — never a score, never a breakdown — so the walkthrough is
built from the score recomputed on the reader's machine, exactly as the card is. A link minted
before this existed opens with an explanation it was never sent.

`SCORER_VERSION` stays at 1, which is the load-bearing part, for the same reason 0003 gives: its
documented bump list is `C_PAR`, `EPSILON`, a regenerated `PAR`, or the aggregation and outcome
terms. A display change is on none of them, and bumping it would make every link already sent
announce itself as scored by a different version of Par.

`tests/app/explainer.test.tsx` opens the same link 0003 froze — minted at `e4e1210`, byte for byte —
and checks the walkthrough names that sender's four guesses and adds up to the total this build
recomputes for them.

## What it costs

**The dialog is longer.** It is scrollable, the round comes first, and the general account below it
was trimmed where the walkthrough now says the same thing concretely.

**The invented example now sits under a real one.** BATCH, CATCH and HATCH describe a position that
cannot be a real Par position — decision [0001](0001-plan-reconciled-with-spec.md) requires that —
and it is now a scroll below a walkthrough of the reader's actual guesses. It stays under a heading
that says the section explains why the scoring works this way, and opens with "suppose", because the
alternative is losing the one passage that teaches why a word that cannot win can be the best play.

**A round still scoring has no walkthrough.** The score is optional and the dialog reads without it,
which is also what a replay this build declines to score falls back to.

## Reversing it

`src/app/copy/explainer.ts` is the whole of it, plus the block it fills in `ScoringExplainer.tsx` and
the `score` prop its two callers pass. Drop the prop and the dialog is the general account again.
