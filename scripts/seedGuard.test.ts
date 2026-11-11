import { describe, it, expect } from 'vitest'
import { assertSafeSeedTarget, parseDatabaseUrls } from './seedGuard'

const PROD = 'postgres://prod-host/db'
const prodEnv = `POSTGRES_URL="${PROD}"\nDATABASE_POSTGRES_URL="${PROD}"\n`

describe('parseDatabaseUrls', () => {
  it('handles double quotes with trailing comment', () => {
    expect(parseDatabaseUrls(`DATABASE_URL="${PROD}" # production`)).toEqual([PROD])
  })
  it('handles single quotes', () => {
    expect(parseDatabaseUrls(`POSTGRES_URL='${PROD}'`)).toEqual([PROD])
  })
  it('handles export prefix', () => {
    expect(parseDatabaseUrls(`export DATABASE_POSTGRES_URL=${PROD}`)).toEqual([PROD])
  })
  it('returns empty when no URL vars', () => {
    expect(parseDatabaseUrls('FOO=1')).toEqual([])
  })
})

describe('assertSafeSeedTarget', () => {
  it('refuses when DATABASE_URL matches production', () => {
    expect(() =>
      assertSafeSeedTarget({ DATABASE_URL: PROD }, `DATABASE_URL=${PROD}`),
    ).toThrow(/production/)
  })

  it('refuses when prod fixture only has POSTGRES_URL/DATABASE_POSTGRES_URL', () => {
    expect(() => assertSafeSeedTarget({ DATABASE_URL: PROD }, prodEnv)).toThrow(/production/)
  })

  it('refuses when process env only has POSTGRES_URL set to prod', () => {
    expect(() => assertSafeSeedTarget({ POSTGRES_URL: PROD }, prodEnv)).toThrow(/production/)
  })

  it('refuses when only DATABASE_POSTGRES_URL is set to prod', () => {
    expect(() => assertSafeSeedTarget({ DATABASE_POSTGRES_URL: PROD }, prodEnv)).toThrow(/production/)
  })

  it('allows a different (dev) URL', () => {
    expect(() =>
      assertSafeSeedTarget({ DATABASE_URL: 'postgres://dev-host/db' }, prodEnv),
    ).not.toThrow()
  })

  it('allows production when SEED_ALLOW_PRODUCTION=1', () => {
    expect(() =>
      assertSafeSeedTarget({ POSTGRES_URL: PROD, SEED_ALLOW_PRODUCTION: '1' }, prodEnv),
    ).not.toThrow()
  })

  it('does not treat an empty flag as allowed', () => {
    expect(() =>
      assertSafeSeedTarget({ POSTGRES_URL: PROD, SEED_ALLOW_PRODUCTION: '' }, prodEnv),
    ).toThrow(/production/)
  })

  it('does nothing when .env.production is absent', () => {
    expect(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://a/b' }, null)).not.toThrow()
  })
})
