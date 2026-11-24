import { describe, it, expect } from 'vitest'
import { assertDevDatabase } from './devInviteSeed'

const DEV = 'postgres://u:p@aws-0.pooler.supabase.com:6543/postgres?options=project%3Dgifuabcdef'
const PROD = 'postgres://u:p@aws-0.pooler.supabase.com:6543/postgres?options=project%3Dzhjfabcdef'

describe('assertDevDatabase', () => {
  it('accepts the forkful-dev database', () => {
    expect(() => assertDevDatabase({ DATABASE_URL: DEV })).not.toThrow()
  })

  it('refuses a production URL', () => {
    expect(() => assertDevDatabase({ DATABASE_URL: PROD })).toThrow(/dev/i)
  })

  it('refuses an unknown URL, even when it is not production', () => {
    expect(() => assertDevDatabase({ DATABASE_URL: 'postgres://other-host/db' })).toThrow(/dev/i)
  })

  it('refuses when no URL is set', () => {
    expect(() => assertDevDatabase({})).toThrow(/dev/i)
  })

  it('refuses when any database variable points elsewhere', () => {
    expect(() => assertDevDatabase({ DATABASE_URL: DEV, POSTGRES_URL: PROD })).toThrow(/dev/i)
  })

  it('refuses on Vercel or a production runtime', () => {
    expect(() => assertDevDatabase({ DATABASE_URL: DEV, VERCEL: '1' })).toThrow(/dev/i)
    expect(() => assertDevDatabase({ DATABASE_URL: DEV, VERCEL_ENV: 'production' })).toThrow(/dev/i)
  })
})
