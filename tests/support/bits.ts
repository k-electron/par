/**
 * Reading doubles as bits.
 *
 * Spec §5 asks for scoring that is *bit-identical* across machines, so the
 * determinism tests compare bit patterns rather than values: two numbers that
 * `toBe` each other can still differ in a way that a later multiplication would
 * expose, and `toBeCloseTo` would hide exactly the divergence being hunted.
 */

const view = new DataView(new ArrayBuffer(8));
const BIG_ENDIAN = false;

/** The IEEE-754 bit pattern of `value`, as sixteen hex digits. */
export function float64Bits(value: number): string {
  view.setFloat64(0, value, BIG_ENDIAN);
  return view.getBigUint64(0, BIG_ENDIAN).toString(16).padStart(16, '0');
}

/**
 * How many representable doubles lie between `left` and `right`.
 *
 * Zero means the two are the same double. Used to say "within one ULP of
 * `Math.log2`" precisely, rather than picking an epsilon and hoping.
 */
export function ulpsApart(left: number, right: number): number {
  if (left === right) {
    return 0;
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Number.POSITIVE_INFINITY;
  }

  const ordered = (value: number): bigint => {
    view.setFloat64(0, value, BIG_ENDIAN);
    const bits = view.getBigUint64(0, BIG_ENDIAN);
    // Map the sign-magnitude layout onto a monotonic integer so that counting
    // steps works across zero.
    return bits & 0x8000000000000000n
      ? 0x8000000000000000n - (bits & 0x7fffffffffffffffn)
      : bits + 0x8000000000000000n;
  };

  const difference = ordered(left) - ordered(right);
  return Number(difference < 0n ? -difference : difference);
}
