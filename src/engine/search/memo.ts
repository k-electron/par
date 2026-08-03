/**
 * Memoising `V`, with the cycle guard spec §3 asks for.
 *
 * **Why the key is not the candidate set alone.** In hard mode `V(S)` is not a
 * function of `S`: two paths reaching the same candidate set can carry different
 * accumulated constraints, so they have different legal sets and different
 * values. The key is therefore the constraints *and* the set. In normal mode the
 * constraint key is empty, so the key degenerates to the set on its own and
 * nothing is lost.
 *
 * **Why the key is exact rather than hashed.** A hash collision would not throw
 * or look wrong; it would return one position's value for another and silently
 * publish a score the player never earned. Spec §13 ranks silent divergence
 * second only to correctness, so the key is the whole state as a string and two
 * different states cannot share an entry.
 *
 * **Why sets are keyed by answer index.** Answer indices are properties of the
 * word list, not of the search, so an entry stays valid however the search is
 * set up — and the string is short, since a candidate set is a handful of words
 * by the time anything gets memoised.
 */

/**
 * A memo table for `V`, plus the record of which positions are mid-computation.
 */
export interface ValueMemo {
  /** The known value of a position, or `undefined`. */
  get(key: string): number | undefined;
  /**
   * Whether this position is already being computed further up the stack.
   *
   * Spec §3's cycle guard. Recursion should already be impossible — excluding
   * non-splitting guesses means every child set is strictly smaller than its
   * parent — so this exists to turn a future mistake into a bounded wrong answer
   * rather than a hung tab.
   */
  isInProgress(key: string): boolean;
  begin(key: string): void;
  /** Record and return a computed value. */
  finish(key: string, value: number): number;
  /** How many positions have been solved, for the performance tests. */
  readonly solved: number;
}

export function createValueMemo(): ValueMemo {
  const solved = new Map<string, number>();
  const inProgress = new Set<string>();

  return {
    get: (key) => solved.get(key),
    isInProgress: (key) => inProgress.has(key),
    begin: (key) => {
      inProgress.add(key);
    },
    finish: (key, value) => {
      inProgress.delete(key);
      solved.set(key, value);
      return value;
    },
    get solved() {
      return solved.size;
    },
  };
}

/**
 * The key of a candidate set, given as answer indices.
 *
 * One UTF-16 code unit per member. Injective, because a code unit is written
 * per index and the indices arrive ascending — a lone surrogate is still a
 * distinct code unit and so still a distinct key. Built in chunks because
 * spreading a few thousand arguments into `String.fromCharCode` can overflow the
 * call stack.
 */
export function candidateSetKey(answerIndices: ArrayLike<number>, count: number): string {
  const CHUNK = 1024;
  let key = '';
  for (let start = 0; start < count; start += CHUNK) {
    const end = Math.min(start + CHUNK, count);
    const codes: number[] = [];
    for (let position = start; position < end; position += 1) {
      codes.push(answerIndices[position] ?? 0);
    }
    key += String.fromCharCode(...codes);
  }
  return key;
}

/**
 * The key of a whole position: its constraints and its candidate set.
 *
 * Joined behind the length of the first part rather than behind a separator
 * character. A separator would only be injective while no constraint key
 * contained it, which is true today and is exactly the sort of premise that
 * stops being true quietly. With the length in front, the two parts are always
 * recoverable whatever either of them holds, so a future change to how
 * constraints are encoded cannot make two positions share a memo entry.
 */
export function positionKey(constraints: string, candidates: string): string {
  return `${constraints.length}:${constraints}${candidates}`;
}
