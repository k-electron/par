/**
 * The SearchPolicy port — how much of the legal set gets searched at a node.
 *
 * Spec §3 accepts approximation ("exhaustively minimizing over the full
 * dictionary at every node is too slow") and names the configuration it
 * validated as exact: rank legal guesses by one-step expected information
 * descending, then search only the top *k* **probes** plus the top *c*
 * **candidate words**, applied at every recursion depth, with the two sets
 * deduped preserving rank order.
 *
 * **Probes and candidates are budgeted separately.** The spec's table has two
 * columns, and decision 0001 records that collapsing them into one ladder would
 * give two to three times the intended candidate branching at exactly the nodes
 * where cost concentrates. The dedupe instruction is itself the evidence that
 * "probes" means the whole legal set rather than the non-candidates: the two
 * selections can only overlap if a candidate is allowed to rank as a probe.
 *
 * Making this a port rather than a constant is what lets exactness be tested by
 * swapping the policy instead of writing a second scorer — which decision 0001
 * explicitly removes from scope. A brute-force policy that searches everything
 * *is* the reference implementation of `V` and `Q`.
 */

/** How many guesses of each kind to evaluate at one node. */
export interface SearchBudget {
  /** Best-ranked legal guesses to search. `Infinity` means all of them. */
  readonly probes: number;
  /** Best-ranked members of the candidate set to search, on top of the probes. */
  readonly candidates: number;
}

export interface SearchPolicy {
  /** Named so a failure can say which policy produced it. */
  readonly name: string;
  budgetFor(candidateCount: number): SearchBudget;
}

interface Band {
  /** The band applies when the candidate count is greater than this. */
  readonly above: number;
  readonly probes: number;
  readonly candidates: number;
}

/**
 * The first band whose lower bound the count clears.
 *
 * Ordered descending, so the chain reproduces the spec's table exactly:
 * `|S| > 200 ? … : |S| > 60 ? … : |S| > 15 ? … : …`.
 */
function bandFor(bands: readonly Band[], candidateCount: number): SearchBudget {
  for (const band of bands) {
    if (candidateCount > band.above) {
      return { probes: band.probes, candidates: band.candidates };
    }
  }
  throw new RangeError(`Not a candidate count: ${candidateCount}`);
}

/**
 * Spec §3's validated configuration, both columns as written.
 *
 * | candidate set size | probes *k* | candidates *c* |
 * | ------------------ | ---------- | -------------- |
 * | \|S\| > 200        | 2          | 1              |
 * | 60 < \|S\| ≤ 200   | 3          | 2              |
 * | 15 < \|S\| ≤ 60    | 6          | 4              |
 * | \|S\| ≤ 15         | 12         | 12             |
 */
const VALIDATED_BANDS: readonly Band[] = [
  { above: 200, probes: 2, candidates: 1 },
  { above: 60, probes: 3, candidates: 2 },
  { above: 15, probes: 6, candidates: 4 },
  { above: 0, probes: 12, candidates: 12 },
];

/**
 * A deliberately wider ladder, exhaustive once the field is down to fifteen.
 *
 * Spec §3 asks for scores that are "exact where precision is visible — small
 * candidate sets, endgames — and near-exact elsewhere", and this is one of the
 * two things the validated ladder is checked against.
 *
 * **Be precise about what it does and does not show.** Being exhaustive below
 * fifteen candidates means every one of the ~13,000 guesses with a full
 * recursion, which is tractable only on the small fixture lexicon
 * `tests/engine/exactness.test.ts` uses — and on a fourteen-word lexicon every
 * position is already in the bottom band. So agreement here is evidence about
 * the bottom band and nothing else.
 *
 * The bands the shipped lists actually use are covered separately, in
 * `tests/engine/bands.test.ts`, against a wider-but-tractable ladder on real
 * positions: exact agreement at fifteen candidates or fewer, and a stated
 * tolerance above that.
 */
const WIDE_BANDS: readonly Band[] = [
  { above: 200, probes: 24, candidates: 12 },
  { above: 60, probes: 32, candidates: 16 },
  { above: 15, probes: 48, candidates: 24 },
  { above: 0, probes: Number.POSITIVE_INFINITY, candidates: Number.POSITIVE_INFINITY },
];

export const validatedPolicy: SearchPolicy = {
  name: 'validated',
  budgetFor: (candidateCount) => bandFor(VALIDATED_BANDS, candidateCount),
};

export const widePolicy: SearchPolicy = {
  name: 'wide',
  budgetFor: (candidateCount) => bandFor(WIDE_BANDS, candidateCount),
};

/**
 * Every legal guess at every depth: the definition of `V` in spec §3 with no
 * approximation at all.
 *
 * Only tractable on a small lexicon, which is exactly how it is used — as the
 * reference the approximate policies are compared against on sampled states.
 */
export const bruteForcePolicy: SearchPolicy = {
  name: 'brute force',
  budgetFor: () => ({
    probes: Number.POSITIVE_INFINITY,
    candidates: Number.POSITIVE_INFINITY,
  }),
};
