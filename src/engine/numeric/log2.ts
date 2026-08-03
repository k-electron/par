/**
 * Base-two logarithm built from IEEE-754 primitives only.
 *
 * **Why this exists.** ECMA-262 leaves the precision of `Math.log2` to the
 * implementation, so two engines may disagree in the last few bits. That would
 * be harmless if the value were only displayed, but it ranks the legal guesses
 * and the search then explores the top of that ranking — so a one-ULP
 * difference can reorder two near-tied guesses, change *which* guesses get
 * searched, and move a score discontinuously. Spec §5 calls silent divergence
 * the subtlest requirement in the project, and §13 ranks it second only to
 * correctness. Nothing in the engine may call `Math.log2` or `Math.log`; an
 * ESLint rule enforces that rather than leaving it to prose.
 *
 * **Why this is deterministic.** Every operation below is addition,
 * subtraction, multiplication, division, or a comparison on doubles. IEEE-754
 * requires all of those to be correctly rounded, so they give bit-identical
 * results on every conforming engine. The only other ingredient is reading the
 * exponent field out of the bit pattern, which is not arithmetic at all.
 *
 * **How.** Split `x` into `2^e × m` with `m` in [1, 2) — exact, because
 * dividing by a power of two is exact. Halve `m` when it exceeds √2 so that it
 * lands in [1/√2, √2), which bounds `z = (m - 1) / (m + 1)` by about 0.1716.
 * Then `ln m = 2 · atanh z`, and the `atanh` series in `z²` converges fast
 * enough that fourteen terms leave a truncation error near 10⁻²², far below the
 * rounding error of the arithmetic around it.
 *
 * See docs/determinism.md.
 */

/** log2(e), as the nearest double. A decimal literal converts exactly. */
const LOG2_E = 1.4426950408889634;

/** 2 · log2(e). Doubling is exact, so this needs no literal of its own. */
const TWO_LOG2_E = 2 * LOG2_E;

/** √2, as the nearest double. Only ever compared against, never computed with. */
const SQRT_2 = 1.4142135623730951;

/** 2^52, exactly. Scales a subnormal into the normal range without rounding. */
const TWO_POW_52 = 4503599627370496;

const EXPONENT_BIAS = 1023;
const EXPONENT_MASK = 0x7ff;
const SUBNORMAL_EXPONENT = 0;
const INFINITE_EXPONENT = 0x7ff;

/**
 * How many terms of `atanh z / z = Σ z^2k / (2k + 1)` to sum. With |z| ≤ 0.1716
 * the first dropped term is around 0.1716^28, so the series is exact to well
 * within a double.
 */
const SERIES_TERMS = 14;

/** 1 / (2k + 1) for each term. Division is correctly rounded, so these are too. */
const SERIES_RECIPROCALS = buildSeriesReciprocals();

function buildSeriesReciprocals(): Float64Array {
  const table = new Float64Array(SERIES_TERMS);
  for (let term = 0; term < SERIES_TERMS; term += 1) {
    table[term] = 1 / (2 * term + 1);
  }
  return table;
}

/**
 * Scratch for reading and writing exponent fields.
 *
 * A `DataView` with an explicit endianness is used rather than a `Uint32Array`
 * over the same buffer, because a typed-array view would read the platform's
 * byte order — which would make the result differ between a little-endian and a
 * big-endian machine, the exact failure this module exists to prevent.
 */
const BITS = new DataView(new ArrayBuffer(8));
const BIG_ENDIAN = false;

/** The raw eleven-bit exponent field of `value`. */
function rawExponent(value: number): number {
  BITS.setFloat64(0, value, BIG_ENDIAN);
  return (BITS.getUint32(0, BIG_ENDIAN) >>> 20) & EXPONENT_MASK;
}

/** 2 raised to `exponent`, for exponents in the normal range. */
function powerOfTwo(exponent: number): number {
  BITS.setUint32(0, (exponent + EXPONENT_BIAS) << 20, BIG_ENDIAN);
  BITS.setUint32(4, 0, BIG_ENDIAN);
  return BITS.getFloat64(0, BIG_ENDIAN);
}

/**
 * The base-two logarithm of `x`, bit-identical on every IEEE-754 engine.
 *
 * Matches `Math.log2` on the edges: NaN for NaN and for a negative argument,
 * `-Infinity` at zero, `Infinity` at infinity. Exact at every power of two,
 * which is what makes `log2(1)` exactly zero — spec §3 leans on that, since a
 * single-candidate guess carries aggregation weight `log2(1) = 0`.
 */
export function log2(x: number): number {
  if (Number.isNaN(x) || x < 0) {
    return Number.NaN;
  }
  if (x === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  let value = x;
  let exponent = 0;

  let raw = rawExponent(value);
  if (raw === INFINITE_EXPONENT) {
    return Number.POSITIVE_INFINITY;
  }
  if (raw === SUBNORMAL_EXPONENT) {
    value = value * TWO_POW_52;
    exponent -= 52;
    raw = rawExponent(value);
  }

  const unbiased = raw - EXPONENT_BIAS;
  exponent += unbiased;

  // Exact: the divisor is a power of two, so this only shifts the exponent.
  let mantissa = value / powerOfTwo(unbiased);

  if (mantissa > SQRT_2) {
    // Also exact, and it halves the largest |z| the series has to handle.
    mantissa = mantissa * 0.5;
    exponent += 1;
  }

  const z = (mantissa - 1) / (mantissa + 1);
  const zSquared = z * z;

  let series = SERIES_RECIPROCALS[SERIES_TERMS - 1]!;
  for (let term = SERIES_TERMS - 2; term >= 0; term -= 1) {
    series = series * zSquared + SERIES_RECIPROCALS[term]!;
  }

  // A power of two leaves mantissa at exactly 1, so z is exactly 0 and the
  // logarithm comes back as the exponent with nothing added to it.
  return exponent + z * series * TWO_LOG2_E;
}

/**
 * A table of `n · log2 n` for n in 0..max, with 0 at both ends.
 *
 * This is the quantity the entropy ranking accumulates, so precomputing it
 * keeps the series out of the inner loop entirely: a node's ranking becomes
 * table lookups over integer bucket sizes. `0 · log2 0` is 0 by the limit,
 * which is also what an empty partition should contribute — spec §3's first
 * guard clause, met by construction here rather than by a branch.
 */
export function weightedLog2Table(max: number): Float64Array {
  if (!Number.isInteger(max) || max < 0) {
    throw new RangeError(`Not a table size: ${max}`);
  }
  const table = new Float64Array(max + 1);
  for (let count = 2; count <= max; count += 1) {
    table[count] = count * log2(count);
  }
  return table;
}
