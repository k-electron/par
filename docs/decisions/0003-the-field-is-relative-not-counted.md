# 0003 — The field is shown as a proportion, never as a count

Status: accepted. The spec never asked for candidate counts, so nothing is departed from — but the
results view printed them from the day it existed, and this records why it stopped, so the column is
not "improved" back.

## What was on screen

The per-guess table's second column reported the candidate set as two exact integers: the count the
guess left behind, with the count it started from as the caption. A row read `253` over `from 3000`,
and the winning row read `—` over `solved`.

## Why that had to go

**The first row gave away the answer list's size, on every round ever played.** A guess played into
an empty history faces the whole list, so the caption under row 1 was always `from 3000`. That says
the answers are a curated three thousand rather than the 12,972 words the game accepts — a fact the
game had never otherwise volunteered.

**Every other row was a membership oracle.** The guess and its pattern are both on screen, and the
guess dictionary ships in the bundle, so the set of dictionary words consistent with a row is
computable by anyone who cares. The number beside it said exactly how many of them are possible
answers. Collect a few rounds and the answer list falls out of the constraints, one intersection at
a time.

**And `docs/philosophy.md` already assumed otherwise.** Its rationale for benchmarking against the
answer list rather than the dictionary rests on the pool being invisible:

> Using the answer pool is the only self-consistent choice, even though players can't see that pool.
> For a casual audience this is fine: people reason about "a normal word" intuitively and land in
> roughly the right place without ever enumerating it.

The column was the one place enumerating it. This restores an assumption the design was already
making rather than adding a new rule to the pile.

**This is not secrecy, and nothing here is defended.** Position 13 is explicit that the lists ship
in the bundle and that no effort should go into hiding them or into publishing them, and the decision
framework's last question rules out complexity aimed at an adversary who does not exist. Anyone who
wants the answer list can still read it out of the page source in a minute. The change is that the
ordinary results screen stops handing it over unprompted, which costs nothing to do.

## What we do instead

Two things per row, neither of them a number:

- **A bar**, `log2 remaining / log2 |S_1|` wide, for how much of the field the guess left standing.
  Logarithmic because a linear bar would be all but empty from row 2 down, and because an equal cut
  then shortens it by an equal amount. It empties exactly when one word is left, so a solved round
  ends empty and a round that ran out of turns with the field wide does not.
- **A phrase** for how far the field fell: `nothing ruled out`, `narrowed a little`, `about halved`,
  `down to a quarter`, `down to a tenth`, `cut to a fraction`, and `solved` on the winning row.

The header changed from `Words left`, which promised a count, to `Field`, which the engine already
uses for the same quantity — *a field that halved reports exactly one bit*.

**The bands are decided by integer comparison**, `after * 4 > before` and so on, rather than from
`log2(before / after)`. A band boundary sitting on a floating-point comparison could word the same
round differently on two machines, and a replay link is meant to read identically for both friends
holding it. `docs/determinism.md` governs scores; this extends the same care to the sentence beside
them, cheaply, because integers cost nothing here.

The bar's own width does use `Math.log2`, which is forbidden inside `src/engine` and fine in the
view: a last-bit difference in a CSS width is a fraction of a pixel, and it cannot change a word.

## What it costs

**The endgame reads less sharply.** "2, from 9" told you precisely how tight the position was; "down
to a quarter" does not. The compensation is that `guessNote` already says `Only one word left` when a
guess faced a single candidate, which is the part of the endgame players actually talk about, and it
reveals nothing about the pool's size.

**A proportion needs a sentence of explanation, and a count did not.** The scoring explainer carries
it, which spec §9 asks for anyway.

Against both: the count was never self-sufficient either. The code that printed it conceded as much
— *253 is a fine cut from 3000 and a poor one from 260* — so the column had always needed the second
number to mean anything. A ratio says it in one figure, and the figure that is left is the one worth
reading.

## Its relationship to #7

[#7](https://github.com/k-electron/par/pull/7) moved the column from reporting the pool a guess was
handed to reporting what it left behind, so that a row described its own guess. That principle is
untouched and is why the bands measure `before → after` rather than the position going in. Only the
units changed.

## Reversing it

`fieldNote` in [`src/app/copy/results.ts`](../../src/app/copy/results.ts) is the whole of it, plus
the bar in `Results.tsx`. Return the counts from there and the old column is back, along with the
first row publishing the size of the answer list. `tests/app/results.test.tsx` asserts that no digit
reaches the column, so this cannot come back by accident.
