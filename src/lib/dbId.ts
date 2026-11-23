const MAX_INT4 = 2147483647

/** True for a positive integer that fits a Postgres `serial` (int4) column, so it is safe to query with. */
export function isValidDbId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_INT4
}
