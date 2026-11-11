/**
 * Pure resolution of the database URL used by drizzle-kit (see drizzle.config.ts).
 *
 * drizzle-kit loads `.env` itself (which points at production here), so the config
 * must explicitly load `.env.local` (or `.env.production` when DRIZZLE_ENV=production)
 * and ignore whatever `.env` put into process.env.
 */

export type EnvRecord = Record<string, string | undefined>

export interface ResolveDrizzleEnvOptions {
  env: EnvRecord
  /** Returns the file contents, or undefined when the file doesn't exist. */
  readFile: (name: string) => string | undefined
}

export interface ResolvedDrizzleEnv {
  url: string
  source: '.env.local' | '.env.production' | 'platform'
}

const URL_KEYS = ['POSTGRES_URL', 'DATABASE_URL', 'DATABASE_POSTGRES_URL'] as const

export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '')
    }
    out[match[1]] = value
  }
  return out
}

function pickUrl(vars: EnvRecord): string | undefined {
  for (const key of URL_KEYS) {
    if (vars[key]) return vars[key]
  }
  return undefined
}

export function resolveDrizzleEnv({ env, readFile }: ResolveDrizzleEnvOptions): ResolvedDrizzleEnv {
  // Vercel build: env vars come from the platform, there are no env files.
  if (env.VERCEL) {
    const url = pickUrl(env)
    if (!url) throw new Error('Drizzle config: no database URL found in the Vercel environment.')
    return { url, source: 'platform' }
  }

  const wantsProduction = env.DRIZZLE_ENV === 'production'
  const file = wantsProduction ? '.env.production' : '.env.local'
  const contents = readFile(file)
  if (contents === undefined) {
    throw new Error(
      wantsProduction
        ? 'Drizzle config: DRIZZLE_ENV=production but .env.production was not found.'
        : 'Drizzle config: .env.local not found. Refusing to fall back to .env (production). ' +
            'Create .env.local pointing at the dev database, or set DRIZZLE_ENV=production to target production on purpose.',
    )
  }

  // Only use values from the chosen file, never the ones drizzle-kit already pulled in from .env.
  const url = pickUrl(parseEnvFile(contents))
  if (!url) throw new Error(`Drizzle config: no database URL (${URL_KEYS.join('/')}) found in ${file}.`)

  if (!wantsProduction) {
    const prodContents = readFile('.env.production')
    const prodUrl = prodContents === undefined ? undefined : pickUrl(parseEnvFile(prodContents))
    if (prodUrl && prodUrl === url) {
      throw new Error(
        'Drizzle config: .env.local points at the production database. ' +
          'Point it at dev, or set DRIZZLE_ENV=production to target production on purpose.',
      )
    }
  }

  return { url, source: file }
}
