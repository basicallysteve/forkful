// Round to two decimal places — the app's numeric(10, 2) money/quantity scale — while avoiding binary
// float artifacts (e.g. 0.1 * 3 = 0.30000000000000004, which must persist as 0.30).
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// Round UP to two decimal places, for a charged total — so a partial cent is never undercharged. The
// scaled value is snapped to 6 places first to strip binary-float noise (0.30 * 100 =
// 30.000000000000004); without that, a value already exactly at the cent would be bumped up a penny.
export function ceil2(value: number): number {
  return Math.ceil(Number((value * 100).toFixed(6))) / 100
}
