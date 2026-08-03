# Determinism

Spec §13 puts this second, behind only correctness: **the same game must produce
the same score everywhere, to the bit.** Spec §5 calls silent divergence the
subtlest requirement in the project, and it is right — a scorer that is 0.3 out on
one phone has no symptom. Nothing crashes, no test goes red, and the score looks
entirely plausible. Two friends comparing results are the error report.

This note is the whole argument for why that cannot happen, and the checklist for
keeping it that way.

## Why a last-bit difference is not cosmetic

It would be, if the numbers were only displayed. They are not. The search ranks
every legal guess by expected information and then explores the best few of them
(spec §3). So a logarithm that differs in its last bit can reorder two near-tied
guesses, which changes **which guesses get searched**, which changes the minimum
that comes back — and that is a discontinuous jump, not a rounding difference. A
one-ULP input error becomes a visibly different score.

That is why the guarantee has to be bit-identity rather than "close enough", and
why the tests assert on bit patterns (`tests/support/bits.ts`) rather than with
`toBeCloseTo`.

## What the engine relies on

**IEEE-754 arithmetic, and nothing else.** Addition, subtraction, multiplication,
division and comparison on doubles are *correctly rounded* — the standard requires
the result to be the representable number nearest the exact answer. Every
conforming engine therefore gives identical bits. All of the scorer's arithmetic
is built from those five operations.

**Its own logarithm.** ECMA-262 leaves the precision of `Math.log2`, `Math.log`,
`Math.pow` and `**` to the implementation, so they are the one place the language
permits engines to disagree. `src/engine/numeric/log2.ts` replaces them: it splits
the argument into `2^e × m` by reading the exponent field, halves `m` if it
exceeds √2, and sums the `atanh` series in the reduced mantissa using only the
five safe operations. It is exact at every power of two across the whole double
range and within one ULP of `Math.log2` everywhere else.

**Byte order it chose itself.** Reading an exponent field means looking at the
bits, and a `Uint32Array` view over a float's buffer would read the *platform's*
byte order — little-endian on every mainstream machine, but not by specification.
`log2.ts` uses a `DataView` with the endianness passed explicitly, so the same
bits are read on any machine.

## The rules

1. **No implementation-defined maths in `src/engine`.** `Math.log`, `Math.log2`,
   `Math.log10`, `Math.log1p`, `Math.exp`, `Math.pow` and the `**` operator are
   banned by an ESLint rule, with fixtures in `tests/determinism-lint.test.ts`
   proving the rule reports and the shipped engine passes it. Prose erodes; a rule
   does not.

   `Math.floor`, `Math.min`, `Math.max`, `Math.abs` and `Math.sqrt` stay allowed:
   IEEE-754 specifies all of them exactly.

2. **No ambient input.** No `Math.random`, no `Date.now`, no locale-sensitive
   comparison, no reading anything from the environment. A score is a pure
   function of the word lists, the ruleset, the policy, the history and the guess.

3. **Every order that feeds arithmetic is fixed.** Floating-point addition is not
   associative, so a sum's value depends on the order of its terms. The engine
   pins every such order:

   - **Candidate sets** are always ascending by answer index. The search
     canonicalises them once and every derived set inherits it, because buckets
     are filled by walking an ascending set into ascending buckets.
   - **The weighted sum of child values** in `Q` is accumulated in ascending
     pattern order, and divided by the candidate count once at the end rather
     than per term. This is the score-bearing sum, so it gets the order that is
     easiest to state and check.
   - **The ranking key** `Σ n_p log2 n_p` is accumulated in the order the occupied
     patterns are first encountered, walking the node's candidates ascending. Also
     a fixed function of the position and the guess — the candidate list is always
     ascending and the matrix row never changes — but *not* the same order as
     above. The difference is deliberate and measured: sweeping all 243 patterns
     to get ascending order costs more than the histogram itself at the small
     candidate sets where most nodes live, and made the whole search about three
     times slower. This key only decides which guesses to look at, whereas the sum
     above is the value itself.
   - **Selection** breaks ties with a total order — ranking key ascending, then
     guess index ascending — so no tie survives to be resolved by whichever
     sorting algorithm an engine happens to use. This is the one place a tie can
     move a score, because it decides which guesses are evaluated at all.

4. **Dense arrays, not `Map` or `Set`, for anything whose iteration order feeds
   arithmetic.** Partitions are 243-slot integer tables indexed by pattern, so
   they are read in pattern order by construction rather than in insertion order.

5. **Memo keys are exact, never hashed.** A hash collision would not throw or look
   wrong — it would return one position's value for another and publish a score
   the player never earned. Keys are the full state as a string: the accumulated
   constraints and the candidate set, joined behind the length of the first part
   so the join is injective whatever either half contains.

6. **The word lists are part of the contract.** Ranking ties break by guess index,
   so the *order* of the guess dictionary can change which guesses are searched.
   Regenerating a list in a different order is a behavioural change, not a
   refactor.

## How it is tested

- `tests/engine/log2.test.ts` pins the kernel with golden bit patterns, and checks
  it against `Math.log2` — accurate, though not reproducible — to within one ULP.
- `tests/determinism-lint.test.ts` proves the ban reports on source that breaks
  it, across every directory of the engine, and that the engine as it stands
  passes.
- `tests/engine/exactness.test.ts` asserts scores are unchanged, bit for bit, by
  repeating them, by a warm memo, by the order guesses are scored in, by the order
  the history arrived in, and by the order the answer list was written in. It also
  checks three policies with different branching agree to the bit, which a bug
  would have to survive being handed a different set of guesses to notice.

## Before changing anything in `src/engine`

Ask: does this introduce a transcendental, a source of ambient input, a `Map` or
`Set` whose iteration order reaches a sum, a hash where an exact key was, or a new
accumulation whose order is not pinned? If the answer to any of those is yes, the
guarantee is gone and no test will necessarily tell you.
