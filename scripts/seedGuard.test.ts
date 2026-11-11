import { describe, it, expect } from 'vitest'
import { assertSafeSeedTarget, parseDatabaseUrl } from './seedGuard'

const prodEnv = 'FOO=bar\nDATABASE_URL="postgres://prod-host/db"\n'

describe('seedGuard', () => {
  it('parses quoted and unquoted DATABASE_URL', () => {
    expect(parseDatabaseUrl(prodEnv)).toBe('postgres://prod-host/db')
    expect(parseDatabaseUrl('DATABASE_URL=postgres://x/y')).toBe('postgres://x/y')
    expect(parseDatabaseUrl('NOPE=1')).toBeNull()
  })

  it('refuses when the URL matches production', () => {
    expect(() =>
      assertSafeSeedTarget({ DATABASE_URL: 'postgres://prod-host/db' }, prodEnv),
    ).toThrow(/production/)
  })

  it('allows a different (dev) URL', () => {
    expect(() =>
      assertSafeSeedTarget({ DATABASE_URL: 'postgres://dev-host/db' }, prodEnv),
    ).not.toThrow()
  })

  it('allows production when SEED_ALLOW_PRODUCTION=1', () => {
    expect(() =>
      assertSafeSeedTarget(
        { DATABASE_URL: 'postgres://prod-host/db', SEED_ALLOW_PRODUCTION: '1' },
        prodEnv,
      ),
    ).not.toThrow()
  })

  it('does nothing when .env.production is absent', () => {
    expect(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://a/b' }, null)).not.toThrow()
  })
})
