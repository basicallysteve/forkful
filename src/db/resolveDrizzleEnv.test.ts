import { describe, it, expect } from 'vitest'
import { resolveDrizzleEnv, parseEnvFile } from './resolveDrizzleEnv'

const PROD = 'postgres://u:p@prod.example.com:6543/db'
const DEV = 'postgres://u:p@dev.example.com:6543/db'

const files = (map: Record<string, string>) => (name: string) => map[name]

describe('resolveDrizzleEnv', () => {
  it('uses .env.local over the production URL drizzle-kit loaded from .env', () => {
    const r = resolveDrizzleEnv({
      env: { DATABASE_URL: PROD },
      readFile: files({ '.env.local': `DATABASE_URL=${DEV}`, '.env.production': `DATABASE_URL=${PROD}` }),
    })
    expect(r).toEqual({ url: DEV, source: '.env.local' })
  })

  it('does not fall back to env values when .env.local lacks a URL', () => {
    expect(() =>
      resolveDrizzleEnv({ env: { POSTGRES_URL: PROD }, readFile: files({ '.env.local': 'FOO=bar' }) }),
    ).toThrow(/no database URL/)
  })

  it('refuses when .env.local is missing and DRIZZLE_ENV is not production', () => {
    expect(() =>
      resolveDrizzleEnv({ env: { DATABASE_URL: PROD }, readFile: files({ '.env': `DATABASE_URL=${PROD}` }) }),
    ).toThrow(/\.env\.local not found/)
  })

  it('refuses when .env.local resolves to the production URL', () => {
    expect(() =>
      resolveDrizzleEnv({
        env: {},
        readFile: files({ '.env.local': `DATABASE_URL="${PROD}"`, '.env.production': `DATABASE_URL=${PROD}` }),
      }),
    ).toThrow(/production database/)
  })

  it('targets production from .env.production when DRIZZLE_ENV=production', () => {
    const r = resolveDrizzleEnv({
      env: { DRIZZLE_ENV: 'production' },
      readFile: files({ '.env.local': `DATABASE_URL=${DEV}`, '.env.production': `DATABASE_URL=${PROD}` }),
    })
    expect(r).toEqual({ url: PROD, source: '.env.production' })
  })

  it('refuses DRIZZLE_ENV=production without .env.production', () => {
    expect(() => resolveDrizzleEnv({ env: { DRIZZLE_ENV: 'production' }, readFile: files({}) })).toThrow(
      /\.env\.production was not found/,
    )
  })

  it('uses platform env vars on Vercel with no env files', () => {
    const r = resolveDrizzleEnv({ env: { VERCEL: '1', POSTGRES_URL: PROD }, readFile: files({}) })
    expect(r).toEqual({ url: PROD, source: 'platform' })
  })

  it('throws on Vercel when no URL is set', () => {
    expect(() => resolveDrizzleEnv({ env: { VERCEL: '1' }, readFile: files({}) })).toThrow(/Vercel/)
  })
})

describe('parseEnvFile', () => {
  it('handles comments, quotes, export and inline comments', () => {
    expect(parseEnvFile('# c\nexport A="x y"\nB=\'z\'\nC=plain # note\n\nbad line')).toEqual({
      A: 'x y',
      B: 'z',
      C: 'plain',
    })
  })
})
