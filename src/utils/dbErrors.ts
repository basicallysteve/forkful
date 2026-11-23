// Postgres SQLSTATE 23503 = foreign_key_violation. drizzle may wrap the driver error as `cause`.
export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null
  return e?.code === '23503' || e?.cause?.code === '23503'
}
