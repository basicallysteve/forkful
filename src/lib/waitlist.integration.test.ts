import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { joinWaitlist, leaveWaitlist, signWaitlistLeaveToken } from './waitlist'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

async function rows(email: string) {
  const { rows } = await pool.query('SELECT email, name, marketing_email_opt_in FROM waitlist_entries WHERE lower(email) = lower($1)', [email])
  return rows
}

describe('waitlist integration tests', () => {
  // The leave token is signed with AUTH_SECRET, which CI does not have: use a test secret.
  beforeAll(() => {
    vi.stubEnv('AUTH_SECRET', 'itest-secret')
  })
  afterEach(async () => {
    await pool.query("DELETE FROM waitlist_entries WHERE email LIKE 'itest%'")
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.end()
  })

  it('creates one entry with opt-in false and no User', async () => {
    const before = await pool.query("SELECT count(*)::int AS n FROM users WHERE lower(email) = 'itest-sam@example.com'")
    const result = await joinWaitlist({ email: 'itest-sam@example.com', name: 'Sam', marketingEmailOptIn: false })
    expect(result.created).toBe(true)
    const found = await rows('itest-sam@example.com')
    expect(found).toHaveLength(1)
    expect(found[0].name).toBe('Sam')
    expect(found[0].marketing_email_opt_in).toBe(false)
    const after = await pool.query("SELECT count(*)::int AS n FROM users WHERE lower(email) = 'itest-sam@example.com'")
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('treats a differently-cased duplicate as the same entry and leaves it unchanged', async () => {
    await joinWaitlist({ email: 'itest-sam@example.com', name: 'Sam', marketingEmailOptIn: false })
    const again = await joinWaitlist({ email: 'ITEST-SAM@Example.com', name: 'Other', marketingEmailOptIn: true })
    expect(again.created).toBe(false)
    const found = await rows('itest-sam@example.com')
    expect(found).toHaveLength(1)
    expect(found[0].marketing_email_opt_in).toBe(false)
    expect(found[0].name).toBe('Sam')
  })

  it('stores an empty name as null', async () => {
    await joinWaitlist({ email: 'itest-noname@example.com', name: '  ', marketingEmailOptIn: true })
    const found = await rows('itest-noname@example.com')
    expect(found[0].name).toBeNull()
    expect(found[0].marketing_email_opt_in).toBe(true)
  })

  it('leaveWaitlist with a valid token deletes the entry', async () => {
    await joinWaitlist({ email: 'itest-leave@example.com', name: 'Lee', marketingEmailOptIn: false })
    const status = await leaveWaitlist(signWaitlistLeaveToken('itest-leave@example.com'))
    expect(status).toBe('removed')
    expect(await rows('itest-leave@example.com')).toHaveLength(0)
  })

  it('leaveWaitlist with a tampered token deletes nothing', async () => {
    await joinWaitlist({ email: 'itest-keep@example.com', name: 'Kay', marketingEmailOptIn: false })
    const token = signWaitlistLeaveToken('itest-keep@example.com')
    const status = await leaveWaitlist(token.slice(0, -2) + 'xx')
    expect(status).toBe('invalid')
    expect(await rows('itest-keep@example.com')).toHaveLength(1)
  })

  it('leaveWaitlist is idempotent for a valid token whose entry is already gone', async () => {
    const status = await leaveWaitlist(signWaitlistLeaveToken('itest-nobody@example.com'))
    expect(status).toBe('removed')
  })
})
