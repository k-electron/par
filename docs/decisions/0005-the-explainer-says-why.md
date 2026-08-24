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

> Skill 94.6% — THIEF could have won outright. It was close to the quickest way home from there.
>
> Luck −1.7 — the tiles came back the likeliest way THIEF could break, which is also the least it
> could tell you: about two fifths of the field was still standing.

Four questions, and where each is answered:

- **Why was a good guess good?** By what it was doing: a live shot that could have won outright, or a
  word that could not have been the answer and was therefore a pure question. The general account
  below already spends a section arguing that a word which cannot win can be the best play; naming
  which of the reader's own guesses were which is what connects that lesson to their card.
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

`GuessBreakdown` gains `wasCandidate`, `outcomeShare` and `likeliestOutcomeShare`. All three come off
the pattern histogram `scoreGame` already builds for the luck figure, so nothing new is computed and
no search runs twice.

[0003](0003-the-progress-light.md) keeps the size of the answer pool ours, and 0004 holds that
structurally: `RoundToExplain` omits `candidateCount` and `remainingCount`, so the copy cannot print
a count it is never handed. **That guarantee survives, and the shape of these three is why.** Two are
ratios of the counts and one is a boolean; a ratio between two counts fixes neither, exactly as
0004's argument for `weight` runs. `tests/app/explainer.test.tsx` strips the counts and re-explains
the round, and the fields are listed there one by one rather than spread, so a fourth is a decision
somebody takes rather than something a spread waves through.

**A word that could not have been the answer is a small inferred leak, and it is accepted.** Saying
"GLUES could not have been the answer by then" tells a reader that GLUES is not on the answer list.
0003 already weighed this class of thing and took it: the round is over, the answer is on screen, and
mining the list a word at a time from post-game copy is strictly more work than reading the page
source. What it buys is the only honest answer to why that row scored 50.

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
