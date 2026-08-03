/**
 * Choosing the best-ranked guesses, with a total order.
 *
 * Spec §5 requires "deterministic tie-breaking anywhere you rank or choose among
 * guesses". Ranking is the one place in the search where a tie can move a score:
 * the minimum over `Q` is order-independent because it is a minimum of numbers,
 * but a *selection* decides which guesses get evaluated at all, so two engines
 * that broke a tie differently would search different sets and could report
 * different scores.
 *
 * The order here is total — key ascending, then guess index ascending — so there
 * is no tie left to break and the result cannot depend on which sorting
 * algorithm an engine happens to use.
 */

/** Whether `left` outranks `right`: lower key first, then lower index. */
function outranks(left: number, right: number, keys: Float64Array): boolean {
  const leftKey = keys[left]!;
  const rightKey = keys[right]!;
  return leftKey < rightKey || (leftKey === rightKey && left < right);
}

/**
 * Write the best `limit` members of `from` into `into`, best first, and return
 * how many were written.
 *
 * `keys` is indexed by the values in `from` — the guess index — rather than by
 * position, so that a guess keeps its key whichever list it is being selected
 * out of. Lower keys rank better: the ranking key is `Σ n_p log2 n_p`, which
 * falls as expected information rises.
 */
export function selectBest(
  from: Int32Array,
  fromCount: number,
  keys: Float64Array,
  limit: number,
  into: Int32Array,
): number {
  const capacity = Math.min(limit, fromCount, into.length);
  if (capacity <= 0) {
    return 0;
  }

  if (capacity >= fromCount) {
    // Everything is selected and only the order is in question, so a full sort
    // is both cheaper and simpler than repeated insertion. This is the path a
    // brute-force policy takes.
    for (let position = 0; position < fromCount; position += 1) {
      into[position] = from[position]!;
    }
    into.subarray(0, fromCount).sort((left, right) => {
      const leftKey = keys[left]!;
      const rightKey = keys[right]!;
      if (leftKey < rightKey) {
        return -1;
      }
      if (leftKey > rightKey) {
        return 1;
      }
      return left - right;
    });
    return fromCount;
  }

  // Insertion into a held prefix. The budgets are small — twelve at the widest
  // band of the validated ladder — so this beats sorting the whole legal set,
  // and most guesses fail the comparison against the worst held one immediately.
  let held = 0;
  for (let position = 0; position < fromCount; position += 1) {
    const candidate = from[position]!;

    if (held === capacity && !outranks(candidate, into[capacity - 1]!, keys)) {
      continue;
    }

    let slot = held < capacity ? held : capacity - 1;
    while (slot > 0 && outranks(candidate, into[slot - 1]!, keys)) {
      into[slot] = into[slot - 1]!;
      slot -= 1;
    }
    into[slot] = candidate;

    if (held < capacity) {
      held += 1;
    }
  }

  return held;
}
