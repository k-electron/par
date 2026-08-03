# 0001 — The plan reconciled against the on-disk spec

Status: accepted. Supersedes the implementation plan wherever the two disagree.

## Why this exists

The implementation plan was written against an earlier draft of `docs/spec.md` that was
pasted into a conversation. The version committed to this repository is a later, hardened
revision. An audit of all three documents found the plan reproduces one part of the scoring
model incorrectly, misses a block of guard clauses the spec states outright, and solves for
two word-list requirements that the committed spec does not impose.

`docs/spec.md` is the source of truth. Where the plan disagrees with it, this file records
what we actually build. Read this alongside the plan, not instead of it — everything the plan
says that is not contradicted here still stands.

## Corrections by area

### Word lists

**Guess dictionary size.** The spec asks for `~10k–13k+`, not `13k+`. The plan builds a union
of Collins CSW19, CSW21, NWL2023 and NSWL2023 to reach 13,019 words, justified as clearing a
floor that does not exist. CSW21 is a subset of CSW19 at length five and the North American
lists add 47 words, so the union buys almost nothing for four lexicon sources and four
licensing notes.

We use **Collins CSW19 alone**: 12,972 five-letter words, comfortably inside the stated range,
and the spec's "strongly preferred" source.

**Starter pool split.** The spec says "approximately 90%" and "approximately 10%", then adds
"Target the 90/10 split within a percentage point or so; it needn't be exact." The plan says
"exactly 90/10" in two places. An exact assertion would fail on a pool the spec accepts, and
forces the generator to discard good words to hit a ratio the author twice declined to
require. Assert the split **within one percentage point**.

Words fitting neither bucket — two pairs, or any letter three or more times — are excluded
from the pool entirely.

**Starter pool size** is `~5,000–6,000`. The plan omits it.

### The search configuration

The spec's table has **two columns**, not one. Probes and candidates are budgeted separately:

| candidate set size | probes *k* | candidates *c* |
| --- | --- | --- |
| \|S\| > 200 | 2 | 1 |
| 60 < \|S\| ≤ 200 | 3 | 2 |
| 15 < \|S\| ≤ 60 | 6 | 4 |
| \|S\| ≤ 15 | 12 | 12 |

The plan collapses these into a single `k` of 2/3/6/12 for both, giving two to three times the
intended candidate branching at exactly the nodes where cost concentrates, while calling
itself "the validated configuration". Use the two columns as written.

Two adjacent instructions the plan omits: the policy applies at **every recursion depth**, and
the two sets are **deduped preserving rank order**.

The `k` ladder's boundaries are correct as the plan states them:
`|S| > 200 ? … : |S| > 60 ? … : |S| > 15 ? … : …` reproduces all four bands exactly.

### Guard clauses the plan does not mention

The spec states three things "the formulas above don't say, which you must handle". The plan
covers only the third, and presents it as its own discovery.

- **Skip empty partitions.** Iterate only patterns that actually occur, so `0 × V(∅)` cannot
  produce NaN.
- **Exclude non-splitting guesses.** A guess putting all of `S` into one non-winning bucket
  makes `Q` recurse on the same state forever. Treat as infinitely bad and never selectable,
  with a cycle guard on the memo table.
- **Hard mode inside the recursion.** Hypothetical continuations accumulate the constraints
  they would have generated; a bucket's deeper nodes see the feedback that produced it.

Without the first two, `V` returns NaN or fails to terminate.

### Scoring formula details the plan does not carry

- **Clamp `s_i` at 100.** If a player's guess evaluates better than the search's best, theirs
  becomes the best. With `k = 2` probes above 200 candidates the search is genuinely
  approximate, so this fires in practice.
- **`Skill = 100` when there are no qualifying guesses.** The filter is `i ≥ 2` *and*
  `|S_i| ≥ 2`. Guess-1 exclusion alone leaves `0/0` on any two-guess solve where the opener
  left a single candidate.
- **`|S_i| = 1` scores 100 and carries weight `log2(1) = 0`**, so it contributes nothing
  either way.
- **`Outcome = C_PAR × (PAR − min(n, 7))`, and an unsolved game counts as `n = 7`.** Without
  the floor, losing pays the same as a six-guess solve.
- **`EPSILON` attaches to the toggle, not to the word.** A player who declines the house
  starter and happens to type the same word gets no bonus. The obvious implementation —
  comparing guess one against the day's starter — is precisely what the spec rules out, and
  would pay the bookmark player the mechanic exists to tax.
- **`PAR` is a single global constant, never per-mode.** Hard-mode players sitting slightly
  over par is accepted.
- **`compute-par` simulates strong play opening from house starters**, over a few hundred
  days. Since we recompute rather than inherit 3.50, this definition is the only thing keeping
  the number meaningful.

### Determinism

- **The timezone anchor is a build-time constant, never a user setting.** The plan calls it
  "configurable", which the committed spec explicitly forbids: if players could change it they
  would get different puzzles and the premise collapses.
- **Answers may repeat by chance. Do not build a no-repeat cycle.**
- **The day's starter may equal the day's answer.** Let it stand and do not crash. This
  compounds with the `Skill = 100` base case above, since such a game has no scored guesses.
- The private `log2` also serves the luck stat, which is displayed in the replay play-by-play.
  Route every use through it, and enforce the ban on `Math.log2` in the engine with a lint
  rule rather than prose.

### Gameplay and results

- **Hard-mode legality applies from guess 2 onward, including when guess 1 was the house
  starter.** Name this case in the tests.
- **Show the luck stat for guess 1.** The spec asks for it explicitly — it is the honest
  explanation for a fast finish. Never present it as a grade on the opener choice. The plan's
  otherwise-correct rigour about excluding guess 1 must not swallow this.
- **Forced-move labelling covers the coin flip, not just the single legal guess.** Philosophy
  position 12's motivating case is a player forced into a coin flip, which is two live
  candidates where either scores 100 — not the rarer single-legal-guess case that §10 uses as
  its test. Label whenever the guess was optimal and no better option existed.
- **Badges are factual and celebratory.** Factual: house starter used, hard mode on, solved or
  not. Celebratory: a fast finish, a clean round. All cosmetic, all carrying zero points.
- **The spoiler gate is a confirmation, not a wall.** Someone who chooses to look gets
  straight in.
- **The streak counter is optional and low priority.** The spec's stats list is games played,
  average total, average skill and guess distribution, with the average over time being the
  point. Do not write dedicated streak gap-handling tests.

### Scope removed from the plan

- **The separate reference implementation of `V`/`Q` is dropped.** The plan introduces a
  `SearchPolicy` port specifically so exactness testing is a policy swap "rather than a second
  parallel scorer", then adds a second parallel scorer three paragraphs later. The
  brute-force policy is the reference; comparing policies is what demonstrates exactness.
- **The share link's fragment rationale is corrected.** The plan justifies it as keeping
  payloads out of server logs; there is no server. The real reason is that chat clients unfurl
  URLs, which §7 names as the spoiler vector. Same decision, honest reasoning.

## What the audit confirmed as correct

Recorded so it is not re-litigated: all six feedback vectors are internally consistent under
standard duplicate handling; the `k` ladder boundary operators are right at every band; the
two-candidate check really does yield 100 against 75; the validated constant ranges are quoted
correctly; the per-game pattern matrix sizing is right; and of the plan's five deliberate
divergences, four hold up — recomputing `PAR`, the private `log2`, no plural filter, and the
invented worked example in the explainer. Only the lexicon union did not.

The explainer's worked example carries two constraints: it must describe a position that
cannot be today's, and it must never render on a screen showing a live game.
