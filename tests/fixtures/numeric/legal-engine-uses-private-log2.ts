import { log2 } from '../../../src/engine/numeric/log2';

export function rankingKey(count: number): number {
  return count * log2(count);
}

export function place(rest: number, value: number): number {
  // Exactly rounded under IEEE-754, so these stay allowed.
  return Math.floor(rest / value) + Math.min(rest, value) + Math.sqrt(value);
}
