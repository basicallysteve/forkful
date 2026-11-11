/**
 * Pure resolution of the database URL used by drizzle-kit (see drizzle.config.ts).
 *
 * drizzle-kit loads `.env` itself (which points at production here), so the config
 * must explicitly load `.env.local` (or `.env.production` when DRIZZLE_ENV=production)
 * and ignore whatever `.env` put into process.env.
 */

import { parse } from 'dotenv'

export type EnvRecord = Record<string, string | undefined>

export interface ResolveDrizzleEnvOptions {
  env: EnvRecord
  /** Returns the file contents, or undefined when the file doesn't exist. */
  readFile: (name: string) => string | undefined
}

export interface ResolvedDrizzleEnv {
  url: string
  source: '.env.local' | '.env.production' | 'platform' | 'ci'
}

const URL_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL'] as const

export function parseEnvFile(contents: string): Record<string, string> {
  return parse(contents)
}

export function pickUrl(vars: EnvRecord): string | undefined {
  for (const key of URL_KEYS) {
    if (vars[key]) return vars[key]
  }
  return undefined
}

/** True when the URL matches any URL variable in .env.production (when that file exists). */
function isProductionUrl(url: string, readFile: (name: string) => string | undefined): boolean {
  const contents = readFile('.env.production')
  if (contents === undefined) return false
  const vars = parseEnvFile(contents)
  return URL_KEYS.some((key) => vars[key] === url)
}

export function resolveDrizzleEnv({ env, readFile }: ResolveDrizzleEnvOptions): ResolvedDrizzleEnv {
  // Vercel build: env vars come from the platform, there are no env files.
  if (env.VERCEL) {
    const url = pickUrl(env)
    if (!url) throw new Error('Drizzle config: no database URL found in the Vercel environment.')
    return { url, source: 'platform' }
  }

  // Explicit opt-in for CI: URL comes from process.env, no .env.local needed.
  if (env.DRIZZLE_ENV === 'ci') {
    const url = pickUrl(env)
    if (!url) throw new Error('Drizzle config: DRIZZLE_ENV=ci but no database URL is set in the environment.')
    if (isProductionUrl(url, readFile)) {
      throw new Error('Drizzle config: DRIZZLE_ENV=ci but the URL is the production database. Refusing.')
    }
    return { url, source: 'ci' }
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
    if (isProductionUrl(url, readFile)) {
      throw new Error(
        'Drizzle config: .env.local points at the production database. ' +
          'Point it at dev, or set DRIZZLE_ENV=production to target production on purpose.',
      )
    }
  }

  return { url, source: file }
}
