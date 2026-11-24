/** Allowlist guard for the dev Invite seed: every database URL must be forkful-dev (as in dev_drizzle.py). */
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
