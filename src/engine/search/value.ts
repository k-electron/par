/**
 * `V` and `Q` — the search spec §3 defines the score in terms of.
 *
 * `Q(g, S)` is the expected number of guesses to finish, counting `g`, if `g` is
 * played against candidate set `S` and play is optimal afterwards.
 * `V(S) = min over legal g of Q(g, S)`.
 *
 * Both are computed here by the same recursion, so a policy that searches
 * everything really is the reference implementation of the definition rather
 * than an approximation of it.
 *
 * ## The three guard clauses spec §3 requires
 *
 * 1. **Skip empty partitions.** A pattern no candidate produces contributes
 *    nothing; recursing into it would ask for the value of the empty set and
 *    poison the whole sum with NaN. The bucket loop skips zero counts.
 * 2. **Exclude non-splitting guesses.** A guess that puts every candidate into
 *    one non-winning bucket learns nothing and hands back the position it
 *    started from. Such a guess is infinitely bad and never selectable, which is
 *    also what makes the recursion well-founded: every child set is then
 *    strictly smaller than its parent.
 * 3. **Accumulate hard-mode constraints down the recursion.** A hypothetical
 *    continuation is only worth what it is legally worth, so each child node
 *    inherits the constraints its bucket's pattern would have generated and its
 *    legal set is narrowed to match.
 *
 * ## Where determinism comes from
 *
 * Candidate sets are always ascending, buckets are always visited in ascending
 * pattern order, and the weighted sum of child values is accumulated in that
 * order and divided once at the end. Selection uses a total order. Every
 * logarithm comes from `numeric/log2`. See docs/determinism.md.
 */

import { weightedLog2Table } from '../numeric/log2';
import { constraintKey, type Constraints } from '../rules/constraints';
import type { Ruleset } from '../rules/ruleset';
import type { CompiledLexicon } from '../words/lexicon';
import { PATTERN_COUNT, WIN_PATTERN } from '../words/pattern';
import type { PatternMatrix } from './matrix';
import { candidateSetKey, createValueMemo, positionKey } from './memo';
import type { SearchPolicy } from './policy';
import { selectBest } from './select';

export interface SearchDependencies {
  readonly lexicon: CompiledLexicon;
  readonly ruleset: Ruleset;
  readonly policy: SearchPolicy;
}

export interface Searcher {
  /**
   * `V(S)`: expected guesses to finish from here under optimal play.
   *
   * `candidates` are answer indices, ascending, and must all be columns of the
   * matrix this searcher was built for.
   */
  valueOf(candidates: Int32Array, constraints: Constraints): number;
  /**
   * `Q(g, S)`: expected guesses to finish if `guessIndex` is played here.
   *
   * `Infinity` when the guess splits nothing — see guard clause 2. The caller
   * decides what that means for a score; the search itself only needs it to be
   * unselectable.
   */
  costOf(guessIndex: number, candidates: Int32Array, constraints: Constraints): number;
  /** How many dictionary words these constraints leave legal. */
  legalCount(constraints: Constraints): number;
  /** How many distinct positions have been solved, for the performance tests. */
  readonly solved: number;
}

/** Scratch that has to survive while a node's children are being evaluated. */
interface Frame {
  readonly bucketCount: Int32Array;
  readonly bucketStart: Int32Array;
  readonly bucketCursor: Int32Array;
  readonly order: Int32Array;
  readonly selected: Int32Array;
  readonly legal: Int32Array;
}

/**
 * The value of an endgame, settled by argument rather than by search.
 *
 * A candidate is always legal (see `rules/ruleset.ts`), so with one candidate left
 * it can be played and wins: `V = 1`. With two, playing either wins outright half
 * the time and leaves a single candidate otherwise, so `V = 1 + 1/2` — and nothing
 * beats that, because no guess wins more than half the time from here.
 *
 * These are shortcuts for speed, not assumptions the rest of the search rests on.
 * Delete both call sites and the recursion derives the same two numbers unaided;
 * they exist because endgames are where the node count concentrates, and ranking
 * the whole dictionary at each of them to rediscover the same answer cost seconds
 * per guess. `tests/engine/scoreGuess.test.ts` pins them from the outside anyway:
 * spec §10's exact 100, 75 and 60 all rest on `V = 3/2` being right.
 */
function endgameValue(count: number): number {
  return count === 1 ? 1 : 1.5;
}

/** A node's legal set, and the constraints that produced it. */
interface Legality {
  readonly constraints: Constraints;
  readonly key: string;
  readonly guesses: Int32Array;
  readonly count: number;
}

export function createSearcher(
  dependencies: SearchDependencies,
  matrix: PatternMatrix,
): Searcher {
  const { lexicon, ruleset, policy } = dependencies;
  const { patterns, width } = matrix;

  const memo = createValueMemo();
  const weighted = weightedLog2Table(width);

  // Shared scratch. Safe to share across depths because ranking and selection
  // both finish before a node recurses into anything.
  const rankingKey = new Float64Array(lexicon.guessCount);
  const histogram = new Int32Array(PATTERN_COUNT);
  const occupiedPatterns = new Int32Array(PATTERN_COUNT);
  const chosenProbes = new Int32Array(lexicon.guessCount);
  const candidateGuesses = new Int32Array(width);
  const chosenCandidates = new Int32Array(width);
  const alreadyChosen = new Uint8Array(lexicon.guessCount);
  const keyIndices = new Int32Array(width);
  const everyGuess = Int32Array.from({ length: lexicon.guessCount }, (_, guess) => guess);

  const frames: Frame[] = [];

  function frameAt(depth: number): Frame {
    let frame = frames[depth];
    if (frame === undefined) {
      frame = {
        bucketCount: new Int32Array(PATTERN_COUNT),
        bucketStart: new Int32Array(PATTERN_COUNT),
        bucketCursor: new Int32Array(PATTERN_COUNT),
        order: new Int32Array(width),
        selected: new Int32Array(lexicon.guessCount),
        legal: new Int32Array(lexicon.guessCount),
      };
      frames[depth] = frame;
    }
    return frame;
  }

  /**
   * Score every legal guess by `Σ n_p log2 n_p` over its partition of the node's
   * candidates, lowest first.
   *
   * That is one-step expected information reordered: `H = log2 N − (1/N) Σ n_p
   * log2 n_p`, and `log2 N` is the same for every guess at a node, so ranking on
   * the sum ascending is ranking on information descending. Working with the sum
   * keeps the ranking to table lookups over integer bucket sizes, and avoids
   * introducing a subtraction whose only effect would be to lose precision.
   *
   * The terms are summed in the order the occupied patterns were first seen,
   * walking the node's candidates in ascending order — not in ascending pattern
   * order. Both are deterministic, since the candidate list is always ascending
   * and the matrix row is fixed, so the sequence is a function of the position
   * and the guess alone. Encounter order is used because this loop runs once per
   * legal guess per node and is the search's hot spot: sweeping all 243 patterns
   * instead costs more than the histogram itself at the small candidate sets
   * where most nodes live, which measured as a threefold slowdown overall.
   *
   * The score-bearing sum in `costOfNode` does use ascending pattern order. The
   * difference is deliberate: this key only decides which guesses to look at,
   * whereas that sum is the value itself.
   */
  function rank(
    locals: Int32Array,
    offset: number,
    count: number,
    legality: Legality,
  ): void {
    for (let position = 0; position < legality.count; position += 1) {
      const guess = legality.guesses[position]!;
      const row = guess * width;

      let touched = 0;
      for (let member = 0; member < count; member += 1) {
        const pattern = patterns[row + locals[offset + member]!]!;
        if (histogram[pattern] === 0) {
          occupiedPatterns[touched] = pattern;
          touched += 1;
        }
        histogram[pattern] = histogram[pattern]! + 1;
      }

      let cost = 0;
      for (let slot = 0; slot < touched; slot += 1) {
        const pattern = occupiedPatterns[slot]!;
        cost += weighted[histogram[pattern]!]!;
        histogram[pattern] = 0;
      }

      rankingKey[guess] = cost;
    }
  }

  /**
   * Fill `frame.selected` with the guesses to evaluate at this node, and return
   * how many.
   *
   * Spec §3: the top `k` probes over the whole legal set, plus the top `c`
   * members of the candidate set, deduped preserving rank order. The two
   * selections overlap whenever a candidate ranks well, which is why the spec
   * asks for a dedupe at all.
   */
  function chooseGuesses(
    locals: Int32Array,
    offset: number,
    count: number,
    legality: Legality,
    frame: Frame,
  ): number {
    const budget = policy.budgetFor(count);

    const probeCount = selectBest(
      legality.guesses,
      legality.count,
      rankingKey,
      budget.probes,
      chosenProbes,
    );

    for (let member = 0; member < count; member += 1) {
      const answer = matrix.answers[locals[offset + member]!]!;
      candidateGuesses[member] = lexicon.answerToGuess[answer]!;
    }

    // A candidate always satisfies the constraints its own history generated, so
    // this never drops anything. Narrowing anyway keeps the guarantee local: if
    // it ever did drop one, the benchmark would get easier rather than holding
    // the player to a guess they were not allowed to play.
    let candidateCount = count;
    if (ruleset.restrictsLegalGuesses) {
      candidateCount = ruleset.narrow(
        legality.constraints,
        lexicon.guessLetters,
        candidateGuesses,
        count,
        candidateGuesses,
      );
    }

    const candidatesChosen = selectBest(
      candidateGuesses,
      candidateCount,
      rankingKey,
      budget.candidates,
      chosenCandidates,
    );

    let written = 0;
    for (let position = 0; position < probeCount; position += 1) {
      const guess = chosenProbes[position]!;
      if (alreadyChosen[guess] === 0) {
        alreadyChosen[guess] = 1;
        frame.selected[written] = guess;
        written += 1;
      }
    }
    for (let position = 0; position < candidatesChosen; position += 1) {
      const guess = chosenCandidates[position]!;
      if (alreadyChosen[guess] === 0) {
        alreadyChosen[guess] = 1;
        frame.selected[written] = guess;
        written += 1;
      }
    }
    for (let position = 0; position < written; position += 1) {
      alreadyChosen[frame.selected[position]!] = 0;
    }

    return written;
  }

  /** The legal set a child node inherits, given the pattern that led to it. */
  function childLegality(parent: Legality, guess: number, pattern: number, depth: number) {
    if (!ruleset.restrictsLegalGuesses) {
      return parent;
    }

    const constraints = ruleset.accumulate(parent.constraints, {
      guess: lexicon.guessWords[guess]!,
      pattern,
    });
    const frame = frameAt(depth);
    const count = ruleset.narrow(
      constraints,
      lexicon.guessLetters,
      parent.guesses,
      parent.count,
      frame.legal,
    );

    return { constraints, key: constraintKey(constraints), guesses: frame.legal, count };
  }

  function costOfNode(
    guess: number,
    locals: Int32Array,
    offset: number,
    count: number,
    legality: Legality,
    depth: number,
  ): number {
    const frame = frameAt(depth);
    const { bucketCount, bucketStart, bucketCursor, order } = frame;
    const row = guess * width;

    for (let member = 0; member < count; member += 1) {
      const pattern = patterns[row + locals[offset + member]!]!;
      bucketCount[pattern] = bucketCount[pattern]! + 1;
    }

    let running = 0;
    let occupied = 0;
    for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
      bucketStart[pattern] = running;
      bucketCursor[pattern] = running;
      const size = bucketCount[pattern]!;
      running += size;
      if (size > 0) {
        occupied += 1;
      }
    }

    // Guard clause 2. One bucket holding everything, and it is not the win, means
    // the guess told us nothing: Q would recurse on the same state forever.
    if (occupied === 1 && bucketCount[WIN_PATTERN] === 0) {
      bucketCount.fill(0);
      return Number.POSITIVE_INFINITY;
    }

    // Ascending members into ascending buckets, so every child set is ascending
    // too and its memo key is canonical.
    for (let member = 0; member < count; member += 1) {
      const local = locals[offset + member]!;
      const pattern = patterns[row + local]!;
      order[bucketCursor[pattern]!] = local;
      bucketCursor[pattern] = bucketCursor[pattern]! + 1;
    }

    let total = 0;
    for (let pattern = 0; pattern < PATTERN_COUNT; pattern += 1) {
      const size = bucketCount[pattern]!;
      // Guard clause 1: a pattern nobody produced contributes nothing, and asking
      // for the value of the empty set would poison the sum with NaN.
      if (size === 0) {
        continue;
      }
      // The all-green bucket ends the game. The guess itself is already counted
      // by the leading 1 below, and nothing follows it.
      if (pattern === WIN_PATTERN) {
        continue;
      }

      // Settled without recursing, and — the reason the check is here rather than
      // only inside `valueOfNode` — without building the child's legal set. Most
      // buckets of a large position are endgames, and narrowing the dictionary for
      // each of them was costing seconds per guess in hard mode.
      if (size <= 2) {
        total += size * endgameValue(size);
        continue;
      }

      // Guard clause 3.
      const child = childLegality(legality, guess, pattern, depth + 1);
      total +=
        size * valueOfNode(order, bucketStart[pattern]!, size, child, depth + 1);
    }

    bucketCount.fill(0);

    // Divided once at the end rather than per bucket: fewer roundings, and the
    // exact halves spec §10 expects come out exactly.
    return 1 + total / count;
  }

  function valueOfNode(
    locals: Int32Array,
    offset: number,
    count: number,
    legality: Legality,
    depth: number,
  ): number {
    if (count <= 2) {
      return endgameValue(count);
    }

    for (let member = 0; member < count; member += 1) {
      keyIndices[member] = matrix.answers[locals[offset + member]!]!;
    }
    const key = positionKey(legality.key, candidateSetKey(keyIndices, count));

    const known = memo.get(key);
    if (known !== undefined) {
      return known;
    }
    // Spec §3's cycle guard. Excluding non-splitting guesses should make this
    // unreachable; it exists so that a future mistake is a bounded wrong answer
    // rather than a hung tab.
    if (memo.isInProgress(key)) {
      return Number.POSITIVE_INFINITY;
    }
    memo.begin(key);

    rank(locals, offset, count, legality);
    const frame = frameAt(depth);
    const selectedCount = chooseGuesses(locals, offset, count, legality, frame);

    let best = Number.POSITIVE_INFINITY;
    for (let position = 0; position < selectedCount; position += 1) {
      const cost = costOfNode(
        frame.selected[position]!,
        locals,
        offset,
        count,
        legality,
        depth,
      );
      if (cost < best) {
        best = cost;
      }
    }

    if (!Number.isFinite(best)) {
      // Unreachable with any policy that keeps one candidate in its budget, since
      // a candidate can win outright and so always splits. Loud rather than NaN.
      throw new Error(
        `The ${policy.name} policy searched no splitting guess at a position with ` +
          `${count} candidates, so it has no value.`,
      );
    }

    return memo.finish(key, best);
  }

  function rootLegality(constraints: Constraints): Legality {
    const key = constraintKey(constraints);
    if (!ruleset.restrictsLegalGuesses) {
      return { constraints, key, guesses: everyGuess, count: lexicon.guessCount };
    }

    const frame = frameAt(0);
    const count = ruleset.narrow(
      constraints,
      lexicon.guessLetters,
      everyGuess,
      lexicon.guessCount,
      frame.legal,
    );

    return { constraints, key, guesses: frame.legal, count };
  }

  /** Answer indices to matrix columns, keeping the ascending order. */
  function columnsOf(candidates: Int32Array): Int32Array {
    const columns = new Int32Array(candidates.length);
    for (let member = 0; member < candidates.length; member += 1) {
      const column = matrix.columnOf[candidates[member]!] ?? -1;
      if (column < 0) {
        throw new RangeError(
          `Answer ${candidates[member]} is not a column of this pattern matrix.`,
        );
      }
      columns[member] = column;
    }
    return columns;
  }

  return {
    valueOf(candidates, constraints) {
      return valueOfNode(
        columnsOf(candidates),
        0,
        candidates.length,
        rootLegality(constraints),
        0,
      );
    },
    costOf(guessIndex, candidates, constraints) {
      // No ranking needed here: this node's guess is given rather than chosen,
      // and each child ranks for itself.
      return costOfNode(
        guessIndex,
        columnsOf(candidates),
        0,
        candidates.length,
        rootLegality(constraints),
        0,
      );
    },
    legalCount(constraints) {
      return rootLegality(constraints).count;
    },
    get solved() {
      return memo.solved;
    },
  };
}
