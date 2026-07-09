// Round to two decimal places — the app's numeric(10, 2) money/quantity scale — while avoiding binary
// float artifacts (e.g. 0.1 * 3 = 0.30000000000000004, which must persist as 0.30).
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}
