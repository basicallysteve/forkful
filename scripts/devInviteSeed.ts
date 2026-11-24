/**
 * Guard for the dev-only Invite seed. Unlike seedGuard.ts (which only refuses a URL found in
 * .env.production), this is an allowlist: it runs only when every database variable points at
 * the forkful-dev Supabase project, mirroring .claude/team/dev_drizzle.py. An unknown URL is
 * refused, so a mistyped env file can never write an Invite to production.
 */
const DEV_REF = 'gifu'
const PROD_REF = 'zhjf'
const DB_VARS = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL'] as const

export function assertDevDatabase(env: Record<string, string | undefined>): void {
  const refuse = (why: string): never => {
    throw new Error(`Refusing to seed an Invite: ${why}. This script only runs against the forkful-dev database.`)
  }
  if (env.VERCEL || env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
    refuse('this looks like a production runtime')
  }
  const urls = DB_VARS.map((name) => env[name]?.trim()).filter((v): v is string => !!v)
  if (urls.length === 0) refuse('no database URL is set')
  for (const url of urls) {
    if (url.includes(PROD_REF) || !url.includes(DEV_REF)) refuse('a database URL is not the dev database')
  }
}
