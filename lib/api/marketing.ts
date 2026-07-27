/** Percentage numerator/denominator, rounded to 2 decimals; 0 when the denominator is 0. */
export function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100 * 100) / 100 : 0;
}
