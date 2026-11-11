/**
 * Safety guard for seed scripts: refuse to write to the production database
 * (the DATABASE_URL in .env.production) unless explicitly allowed via
 * SEED_ALLOW_PRODUCTION=1, which only the `seed:usda:prod` script sets.
 */

export function parseDatabaseUrl(envFileContents: string): string | null {
  const match = envFileContents.match(/^\s*DATABASE_URL\s*=\s*(.*)$/m)
  if (!match) return null
  return match[1].trim().replace(/^(['"])(.*)\1$/, '$2') || null
}

export function isProductionTarget(
  currentUrl: string | undefined,
  productionEnvContents: string | null,
): boolean {
  if (!currentUrl || !productionEnvContents) return false
  return parseDatabaseUrl(productionEnvContents) === currentUrl
}

export function assertSafeSeedTarget(
  env: Record<string, string | undefined>,
  productionEnvContents: string | null,
): void {
  if (env.SEED_ALLOW_PRODUCTION === '1') return
  if (isProductionTarget(env.DATABASE_URL, productionEnvContents)) {
    throw new Error(
      'Refusing to seed: DATABASE_URL points at production. Use `bun seed:usda:prod` to seed production deliberately.',
    )
  }
}
