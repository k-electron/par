const LN_2 = 0.6931471805599453;

export function rankingKey(count: number): number {
  return Math.log(count) / LN_2;
}
