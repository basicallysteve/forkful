/**
 * Safety guard for seed scripts: refuse to write to the production database
 * (any DB URL in .env.production) unless explicitly allowed via
 * SEED_ALLOW_PRODUCTION=1, which only the `seed:usda:prod` script sets.
 */
import { parse } from 'dotenv'

/** Same variables and precedence as src/db/index.ts. */
const URL_VARS = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL'] as const

/** All non-empty DB URLs defined in an env file's contents. */
export function parseDatabaseUrls(envFileContents: string): string[] {
  const parsed = parse(envFileContents)
  return URL_VARS.map(name => parsed[name]?.trim()).filter((v): v is string => !!v)
}

/** The URL the seeder will connect with. */
export function effectiveDatabaseUrl(env: Record<string, string | undefined>): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || env.DATABASE_POSTGRES_URL || undefined
}

export function assertSafeSeedTarget(
  env: Record<string, string | undefined>,
  productionEnvContents: string | null,
): void {
  if (env.SEED_ALLOW_PRODUCTION === '1') return
  const current = effectiveDatabaseUrl(env)
  if (!current || !productionEnvContents) return
  if (parseDatabaseUrls(productionEnvContents).includes(current)) {
    throw new Error(
      'Refusing to seed: the database URL points at production. Use `bun seed:usda:prod` to seed production deliberately.',
    )
  }
}
