# Par — Design Philosophy

Companion to the build spec. The spec says *what* to build; this says *why* it's built that way. Read it so that when the spec is silent on something, you can make a call that's consistent with the design instead of guessing.

These are my settled positions as the person designing this game — not a running log of the discussion that produced them. Several were tested by simulation during design; where a test confirmed, sharpened, or corrected a position, I've said so. Where I changed my mind, only the final position appears in the numbered list, with the revision noted at the end.

---

## The problem I'm solving

Wordle isn't competitive, because the outcome is dominated by whether your opening word happened to land near the answer. Two people of identical skill can post a 2 and a 5 on the same day for reasons neither controlled. I want a version my friends and I can actually compete at — one where the number at the end reflects how well you *played*.

But I don't want to sterilize the game to get there. A version with no luck at all would be a chess problem, not a daily puzzle. The goal is to price luck correctly, not remove it.

---

# Luck and skill

### 1. Score decisions, not outcomes.

The unit of evaluation is the guess, judged by what it was worth *before* the tiles flipped. Two players who both correctly narrow the field to a five-way coin flip played equally well; the one who guesses right got a better result, not a better game.

*Implication:* the skill component is computed from expectations only. Realized outcomes must never feed back into it.

### 2. Opener luck is the disease. Later luck is the medicine.

Opening luck is what makes Wordle uncompetitive, because it's luck you're handed before you've made a single meaningful decision. Luck *later* in the game is different — by then you've earned your position, and the gamble you're taking is a choice.

*Implication:* the opener is never skill-scored. Everything from guess two onward is.

### 3. I'm not anti-luck. I'm anti-meta.

The thing I actually want to kill is the player who types the same memorized word every single day and calls it strategy. That's not skill, it's a bookmark. The starter bonus exists to make that a losing habit.

But someone who ignores the bonus, picks some random low-expected-value word, and happens to catch three greens? They should score *above* the disciplined player who took the house starter that day. They took a high-variance, low-EV swing and it landed. That's poker, and it's fun. Punishing it would be punishing exactly the boldness that makes a daily game worth talking about.

*Implication:* opener choice is priced as a position, not graded as a decision. A lucky custom opener is a legitimate win, not a loophole to close. Note that opener luck therefore still flows fully into the outcome term — a lucky opener that saves a guess is worth real points. That's intended: position 2 removes opener luck from the *skill* judgment, not from the game.

**The house starter must be taken blind.** This is the load-bearing detail of the whole mechanic. If you could see the day's word before deciding, you'd take it on good days and decline on bad ones, and the bonus would become free money. Taking it has to be a bet made in the dark. That single requirement is why the game asks you to confirm your choice each day and why the toggles lock afterward — not to police anyone, but because a commitment you can withdraw after peeking isn't a commitment.

### 4. Reward luck only at fair odds.

I'm fine rewarding luck *because* the expected value of a gamble is lower than playing well. That's the entire justification, and it only holds if points scale linearly with guess count. Under a linear payout, minimizing expected guesses and maximizing expected points are the same objective, so a gamble can win you a day but never a season.

The moment the payout curve bends upward — a jackpot for finishing in two — you're paying for variance itself. And variance is free: anyone can manufacture it by guessing recklessly. That converts a skill game into a lottery.

*Implication:* the outcome term stays linear. Fast finishes get celebrated with badges, never with points.

*What testing showed:* this is more robust than I first assumed. A bot that explicitly maximizes its chance of finishing by turn three gains almost nothing, because playing well already nearly maximizes fast finishes — a solve-by-three bonus would need to be absurdly large to distort anything. The genuinely risky shape is a **solve-in-two** bonus, where the distortion threshold is real but still large. So keep the payout linear because it's clean and correct, not because the game is fragile.

---

# Incentives

### 5. The ordering I'm targeting, in expectation.

Over the long run:

> **house starter + play well > own opener + play well > house starter, then ignore it and play well**

The first gap is the bonus doing its job: taking the shared starter should be the mildly better habit, so bookmark players pay a small tax every day. The second gap is larger and matters more: taking the bonus and then reverting to your memorized word must be clearly the worst of the three, or the bonus becomes free money.

*What testing showed:* the scoring does most of this work unaided. Blindly reverting at guess two costs real points, because that guess is priced against a position where clues already existed. The bonus only has to cover the small gap between "my favorite opener" and "a random decent one."

### 6. Daily glory, long-run discipline. Both, deliberately.

On a single day, the reckless gambler who catches three greens can and should top the board. Over many days, they must not — their expected score has to sit below the disciplined player's, because that's what makes position 4 honest.

These two facts are not in tension; they're the design. A game where gamblers never win a day is joyless, and a game where gamblers win the long run is a lottery. Since there are no leaderboards, this shows up as: an individual day's score can be spiky and fun, while a player's own average over time is the honest measure.

*Implication:* don't try to smooth daily variance out. Do make a personal average or history view available, since that's where skill actually shows.

The knob that sets this balance is the points-per-guess rate in the outcome term: raise it and days get spikier and luckier, lower it and skill dominates but daily results get flat and similar. The shipped value was chosen to put a lucky finish comfortably ahead of a disciplined one on the day while leaving the long-run ordering intact. If you change it, you are trading daily drama against long-run fidelity — do it knowingly.

### 7. The bonus has to be tuned to a narrow target.

Too large and everyone takes the house starter and then ignores it — collect the bonus, revert to the bookmark. Too small and nobody takes it and the mechanism is decoration. It needs to sit where you genuinely *want* the starter, and then genuinely want to follow the clues inside it.

*What testing showed:* a flat bonus initially looked wrong, because the value needed to keep the house attractive came out different for casual players than for strong ones. The fix was structural rather than a formula for the bonus: since the opening guess is unscored for *everyone* (position 2), both paths are measured on identical footing, and a single flat value works at every skill level. That's why the spec has one constant and not a curve.

The resulting tax on a bookmark player is a couple of points a day — small enough to feel fair on any given day, decisive over a month. The validated window is wide on both sides, so this isn't a delicate number.

---

# Word lists

### 8. Answers must be words people actually know.

The answer pool is deliberately much narrower than what you're allowed to type. Losing to a word nobody has heard of isn't a challenge, it's an insult — and in a game where we compare scores, an obscure answer wrecks everyone's day equally and tells us nothing. Meanwhile the guess dictionary should be generous, because probing with an odd-but-real word is a legitimate tactic.

### 9. The starter should almost always be respectable, and rarely optimal.

The daily starter is drawn from a pool much wider than the answer list but still filtered for real, reasonably common words — no XYLYL-tier junk. Mostly five distinct letters, since that's most of what makes an opener useful.

The point of that shape: taking the house starter should never feel like a trap, but it should rarely feel like a gift either. If the pool were pristine, the choice would be boring; if it included garbage, taking the bonus would be a sucker's bet and nobody would. A small minority of days should have a doubled letter — those are the spicy ones, informationally weaker and worth a groan. Never a triple; that's past interesting and into unfair.

*What testing showed:* with decent continuation play, starter quality barely affects outcomes — roughly a tenth of a guess between a random decent word and the theoretically best one. So the pool's exact composition isn't delicate, and duplicate-letter days need no compensation.

---

# Scoring mechanics

### 10. Every guess is judged against everything known so far.

Not "did you reuse the clues" — *did you use what the clues made possible*. Those differ. In a BATCH/CATCH/HATCH position, the clue-savvy move is often a word that can't be the answer at all. A scorer that rewarded visible clue-reuse would grade that as a mistake.

*Implication:* the candidate set is the clue history, compressed. Scoring against it handles this automatically — no special rules, no heuristics about what "using the clues" looks like.

### 11. Price words in context. Never blacklist them.

A generic word like ADIEU or STARE is sometimes genuinely a good *second* guess, when the starter revealed little. The scorer must be able to say so.

*What testing showed:* exactly that. The same word scores anywhere from the low 70s to the mid 90s depending on the day, because it's evaluated against the actual position. A player with the judgment to revert *selectively* — only when the clues were thin — keeps most of their score. That judgment is real skill, so they should. The player who reverts blindly eats the average.

*Implication:* there is no "reverting" concept in the code, and there shouldn't be. There are only guesses, priced against states.

### 12. Hard mode is a different constraint, not a different game.

Some of us will play hard mode and some won't. Hard mode shouldn't mean "scored unfairly" — it should mean "fewer good options exist." A player forced into a coin flip by the rules played perfectly, and should be told so.

*Implication:* hard mode restricts the legal set — for the player's guess *and* for the benchmark it's measured against. The formula never changes. A forced move scores 100.

---

# Audience and social

### 13. Friends, casuals, nobody grinding — and no adversaries.

No leaderboards, no accounts, no global anything. The social unit is one person sharing a result and a friend clicking through to see how it went. That single interaction is the product.

Nobody is trying to cheat this, and nobody is writing a bot to farm it. I'm not interested in spending complexity on exploit-proofing. The word lists ship in the bundle and are visible to anyone who opens the page source; the day's answer is derivable by anyone determined enough. That's all fine. I'm equally uninterested in *publishing* the lists as a feature and in *hiding* them — no effort should go either way.

Keep guards proportionate: no anti-cheat, no obfuscation-as-security, no adversary modeling. This does **not** mean skipping mechanics that protect the integrity of a choice — the daily confirm and the locked toggles exist because blind commitment is the mechanic (position 3), not because someone might cheat.

What *does* matter is that nobody gets spoiled by accident.

### 14. Everyone plays the same puzzle, and shares are two things at once.

Competing requires that we all get the same answer and the same starter on a given day, derived identically everywhere with no server to coordinate it.

And the share has to be spoiler-free on its face but fully transparent one click deeper. The emoji grid is the social artifact; the link is the receipt. If a friend can't reconstruct exactly what I did and see the same score I saw, the competition doesn't really exist.

*Implication:* replay must recompute the score from scratch and land on the identical number. Determinism isn't a nice-to-have; it's what makes shared scores mean anything. And accidental spoilers — a glance at a message, a URL preview in a chat client — are the one failure mode worth real care.

---

# Tone

### 15. Price mistakes, don't scold.

The score should feel like a golf card, not a report card. "Played at 94%, a stroke and a half under par" is information. Showing someone the optimal word they missed is a lecture, and it also teaches the meta I'm trying to avoid.

*Implication:* never reveal best play, never rank a player's guess against a named alternative, never editorialize about a bad guess. Price it and move on.

---

---

# Why the mechanics take the shape they do

Rationale for choices that look arbitrary in the spec but aren't. Change these only deliberately.

**Why the benchmark uses the answer list, not the full dictionary.** "Candidates remaining" has to mean *possible answers* remaining, or the numbers are nonsense — a scorer that treats obscure non-answer words as live possibilities would punish a player for correctly sensing that the answer will be a common word. Using the answer pool is the only self-consistent choice, even though players can't see that pool. For a casual audience this is fine: people reason about "a normal word" intuitively and land in roughly the right place without ever enumerating it.

**Why guesses are weighted by the log of the candidate count.** A misstep with three hundred possibilities still alive costs far more than a misstep in a forced endgame, so they shouldn't count equally. Log-weighting also has a useful side effect: it neutralizes the hard-mode inflation problem, where late-game moves are frequently forced and would otherwise pad a score with automatic full marks.

**Why the per-guess score is a ratio rather than a difference.** The raw scale of "expected guesses lost" varies enormously between the opening and the endgame, so a difference isn't comparable across positions and 100 wouldn't be reachable everywhere. A ratio against the best available play means every position offers a real shot at a perfect mark — which is also what makes the number feel fair rather than punitive.

**Why par is anchored to strong play.** If par were the average human result, half the field would be "under par" on any given day and the phrase would mean nothing. Anchoring it to strong play means going under par is an actual accomplishment. Most players will be over par most days; that's the honest baseline, and the tone should carry it lightly (position 15).

---

## Positions I revised during design

Stated explicitly so they don't get re-litigated:

- **I initially assumed the answer list would have to be published** for the scoring benchmark to be fair. For a tryhard audience that's true. For casual friends it isn't — nobody's memorizing thousands of words — so it's simply a non-issue: the lists ship in the bundle, aren't advertised, aren't hidden, and the question is orthogonal to the scoring design.
- **I briefly considered scoring the opening guess as a skill decision.** That's incompatible with position 3: it would double-punish the bold random opener I explicitly want to reward. The opener is unscored.
- **I expected opener quality to matter more than it does.** With good continuation play, a random decent word costs about a tenth of a guess versus the best possible opener. That's *why* the bonus is the right tool for discouraging bookmark players — the game genuinely doesn't care much which reasonable word you open with, so suppressing luck wouldn't have achieved anything. The incentive does.
- **I considered a separate scoring formula for hard mode**, then rejected it: same formula, different legal set (position 12).
- **The jackpot risk is real but not delicate** (position 4).

---

## Ideas deliberately rejected

- **Leaderboards and rankings** — wrong social model for this group.
- **Any effort spent hiding or advertising the word lists** — a non-issue either way (position 13).
- **Scoring the opening guess** — punishes the bold play I want to allow (position 3).
- **Showing the day's starter before the choice is locked in** — destroys the blind bet that the bonus is paying for (position 3).
- **A per-mode par, or any other compensation for hard mode's difficulty** — the badge tells the reader which mode was played; adjusting the scale would muddy what the number means.
- **Any convex payout for fast finishes** — pays for variance (position 4).
- **Special-casing particular words** as "reverting" or otherwise — context is the only fair judge (position 11).
- **A separate scoring formula for hard mode** — same formula, different legal set (position 12).
- **Multiple simultaneous boards, or best-of-N averaging** — these reduce variance by dilution rather than pricing it correctly, and turn the game into something else.
- **Revealing optimal play, hints, or suggestions** — teaches the meta and sours the tone (position 15).
- **Anti-cheat, anti-bot, or exploit-hardening machinery** — wrong problem for this audience (position 13).

---

## Using this document

When the spec doesn't cover a case, resolve it by asking, in order:

1. Does this let a realized outcome leak into the skill score? Then no.
2. Does this pay someone for variance rather than for decisions? Then no.
3. Does this make a memorized-opener habit more attractive? Then no.
4. Does this risk spoiling someone who didn't ask to be spoiled? Then no.
5. Does this make the daily loop slower or preachier? Probably no.
6. Is this complexity defending against an adversary who doesn't exist? Then no.

And if a proposal would improve the game but contradicts something here, say so explicitly rather than quietly implementing it — the reasoning above is load-bearing, but it isn't sacred.