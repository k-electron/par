# 0005 — The explainer says why a row scored what it did

Status: accepted. [0004](0004-the-explainer-works-your-own-round.md) put the reader's own round in the
dialog and answered "what is this number". This answers "why is it that number", which is the
question a reader actually leaves with, and it is the reason the wording could not simply be
softened.

## What was on screen

Each scored guess restated the formula with its own word in it:

> Skill 94.6% — what the best available play needed from there, as a share of what THIEF needed.
>
> Luck −1.7 — the tiles revealed 1.7 halvings less than THIEF could expect.

Both sentences are true and neither is legible.

**The skill line is a ratio of two invisible quantities, in the order the formula computes it.** It
divides expected turns to finish under the best available play by expected turns to finish after
playing THIEF, and the noun both sides share — turns — never appears. "As a share of what THIEF
needed" is the division, spelled out in words, for a reader who was not told what either side is.

**The luck line has a units mismatch on top of jargon.** Information is what is revealed and halvings
are what it is measured in, so nothing "reveals a halving". And "a halving" was defined once, in a
paragraph above, then used as a bare noun three rows running.

**Neither says why.** A reader who wants to play better learns that their guess scored 94.6% and not
one thing about what the guess was doing, what it risked, or what the tiles did to it.

## What replaces it

Every row now names what kind of move it was, and then either where it stood or what it cost:

> Skill 94.6% — THIEF was among the commonest of the words that still fitted, so it was a real bet
> on the answer. It was close to the quickest way home from there.
>
> Luck −1.7 — the tiles came back the likeliest way THIEF could break, which is also the least it
> could tell you: about two fifths of the field was still standing.

Four questions, and where each is answered:

- **Why was a good guess good?** By where it sat on the list of words that still fitted the clues,
  from the common end down. The general account below already spends a section arguing that a word
  which was never going to win can be the best play; placing each of the reader's own guesses on
  that list is what connects the lesson to their card. The next section is why it is a place on a
  list rather than a yes or no.
- **Why was a weak guess weak?** By what it was risking. Below the table's own `Near best` band the
  row also carries what its likeliest break would have left standing, and prices the gap in turns:
  "about 15% more turns than the best play available".
- **Why did the tiles break well or badly?** By where the outcome sat among the outcomes that guess
  could have produced. Landing in its biggest bucket is both the likeliest thing that could happen
  and the least informative, which is a fact about the guess rather than a verdict on the player.
- **Why is the winning row's luck so large?** Because finishing turns over everything left to find
  out. Unsaid, that figure reads as a second helping of praise for the guess that happened to land,
  which is the one reading the separation of skill from luck exists to prevent.

## Three new figures, and why they are not counts

`GuessBreakdown` gains `standing`, `outcomeShare` and `likeliestOutcomeShare`. The last two come off
the pattern histogram `scoreGame` already builds for the luck figure, so they cost nothing; the first
is one sweep of the dictionary per guess, which is noise beside the search it sits next to.

[0003](0003-the-progress-light.md) keeps the size of the answer pool ours, and 0004 holds that
structurally: `RoundToExplain` omits `candidateCount` and `remainingCount`, so the copy cannot print
a count it is never handed. **That guarantee survives, and the shape of these three is why.** Two are
ratios of the counts and one is a boolean; a ratio between two counts fixes neither, exactly as
0004's argument for `weight` runs. `tests/app/explainer.test.tsx` strips the counts and re-explains
the round, and the fields are listed there one by one rather than spread, so a fourth is a decision
somebody takes rather than something a spread waves through.

## The copy places a guess on a list; it never excludes it from one

The first version of this said "GLUES could not have been the answer by then", and that is a
membership test with the answer taken out. **A word falls outside the answers two different ways and
only one of them is the reader's to see.** A word the tiles ruled out is visibly dead on the board in
front of them, so saying so tells them nothing they did not have. A word that is merely absent from
the answer list looks alive and is not — and a sentence that calls it impossible publishes that
absence, one word per round, for as long as anybody plays. That is the enumeration
[0003](0003-the-progress-light.md) took the counts off the table to prevent, arriving a word at a
time rather than all at once, and in one respect it is worse than the count column was: a count
describes a position nobody revisits, where this is a durable fact about a specific word the reader
chose and will remember.

The model that replaces it is the one a player already has, and it happens to be the implementation:

> After each round of tiles some words still fit every clue. The answer is always one of the
> commoner ones. So each guess sits somewhere on that list, from the common end down.

That is exactly what `tools/wordlists/build.py` does — the answer list is the dictionary ranked by
Zipf frequency and cut at three thousand, so "the answer list" and "the top slice of the words that
still fit" are the same object described from two sides. Saying it out loud costs nothing and
explains, for the first time anywhere in the UI, why some perfectly real word was never treated as a
live answer.

| instead of | the copy says |
| --- | --- |
| `GLUES could not have been the answer by then` | `GLUES sat well down the words that still fitted, and by then the clues were pointing hard at the top of that list` |
| `LOPES could not have been the answer, so it was a pure question` | `LOPES sat well down the words that still fitted, so it was a question rather than a bet` |
| `THIEF could have won outright` | `THIEF was among the commonest of the words that still fitted, so it was a real bet on the answer` |

**Bands, never a figure, and the reason is the shape of the data.** Only the top slice carries an
order, because frequency is what selected it; below the cut there is no ranking to read. `standingOf`
therefore places a word from down there in the middle of the unranked tail, which is the honest
expectation when all that is known is which side of the cut it fell — and a printed "67% of the way
down" would dress that estimate up as a measurement. Five coarse bands also blur the cut instead of
publishing it: an uncommon word that is on the list and a word just below it land in the same band,
and a reader has no way to tell which of the two they are holding.

`tests/app/explainer.test.tsx` scans every sentence of every round for impossibility language, so the
flat version cannot come back by accident, and walks the standing across its whole range to check
that all five bands fire over one unbroken stretch each.

**What a determined reader can still assemble.** The separation is soft, not absolute: a word from
the tail can only land in the lower bands, so a reader who saw the same word placed differently in
two rounds could learn something about where the cut is. That is a long way from the old sentence,
which simply told them. And the results table's own `Only one word left` still implies, on that one
row, that the guess beside it was not that word — an inference the table and the 50% already carried
before this dialog said anything, and the unavoidable price of the row explaining itself at all.

## What could not be used, and this is the interesting part

**One-step information looked like the obvious "why" and is the wrong number.** On the round this
work came from, THIEF ranked 432nd of 2,327 legal words by expected information and asked for 73% of
what was on offer — while scoring 94.6% on skill. Both are right: skill is a ratio of expected turns
to finish under continued optimal play, and information is one move deep. A "why" built on bits would
have contradicted the figure printed beside it on about every second row.

So the reasons here are structural — what the guess could have been, what its likeliest break would
have left — and the magnitude always comes from the skill score itself, restated as turns.

## What is deliberately still not said

**No word nobody played is named, and no count is printed.** Both prohibitions are tested against the
round's own figures rather than against a list of phrases.

**No coin-flip wording, though the temptation was real.** A two-word field is `weight === 1`, so
"a straight coin flip between the last two" was one comparison away. It is not there, because
`tests/app/explainer.test.tsx` doubles every weight and demands identical output — a test that would
have caught it, and is right to. Zero is the only weight value this module reads, and `0 × 2` is
still zero.

**No sentence about how many turns a row cost when the score declines to count it.** A guess facing a
single word weighs `log2 1 = 0` and cannot move the average, so pricing it would put the loudest
sentence on the card against the one row the score ignores.

## Old links

Nothing was needed. A share link carries the puzzle number, the flags, the guess indices and two
version stamps — never a figure — so every sentence here is rebuilt from a score recomputed on the
reader's machine.

`SCORER_VERSION` stays at 1. Its documented bump list is `C_PAR`, `EPSILON`, a regenerated `PAR`, or
the aggregation and outcome terms. Three display-only fields are on none of them, and bumping it
would make every link already sent announce itself as scored by a different version of Par.

## Reversing it

`skillStory` and `luckStory` in [`src/app/copy/explainer.ts`](../../src/app/copy/explainer.ts) are the
whole of the copy. The three fields on `GuessBreakdown` are read nowhere else, so deleting the
sentences and the fields together leaves the scorer untouched.
