import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createInvite, getInviteByEmail, signUpWithInvite } from './invites'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

const base = { password: 'StrongPass1!', cuisinePreferences: [], dietaryRestrictions: [] }

async function invite(email: string) {
  const result = await createInvite({ email })
  if (result.status !== 'created') throw new Error('invite not created')
  return result.code
}

async function userCount(email: string) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users WHERE lower(email) = lower($1)', [email])
  return rows[0].n as number
}

async function usedAt(email: string) {
  const { rows } = await pool.query('SELECT code_used_at FROM invites WHERE lower(email) = lower($1)', [email])
  return rows[0]?.code_used_at as Date | null
}

describe('invites: sign-up with a code (integration)', () => {
  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE 'itest%'")
    await pool.query("DELETE FROM invites WHERE email LIKE 'itest%'")
  })
  afterAll(async () => {
    await pool.end()
  })

  it('creates the user and marks the code used', async () => {
    const code = await invite('itest-invite-a@example.com')
    const result = await signUpWithInvite({ ...base, username: 'itestinvitea', email: 'itest-invite-a@example.com', code })
    expect(result.status).toBe('created')
    expect(await userCount('itest-invite-a@example.com')).toBe(1)
    expect(await usedAt('itest-invite-a@example.com')).toBeInstanceOf(Date)
  })

  it('matches the email case-insensitively', async () => {
    const code = await invite('itest-invite-b@example.com')
    const result = await signUpWithInvite({ ...base, username: 'itestinviteb', email: 'ITEST-Invite-B@Example.com', code })
    expect(result.status).toBe('created')
  })

  it('fails the second redemption of the same code', async () => {
    const code = await invite('itest-invite-c@example.com')
    await signUpWithInvite({ ...base, username: 'itestinvitec1', email: 'itest-invite-c@example.com', code })
    await pool.query("DELETE FROM users WHERE username = 'itestinvitec1'")
    const again = await signUpWithInvite({ ...base, username: 'itestinvitec2', email: 'itest-invite-c@example.com', code })
    expect(again.status).toBe('invalid-code')
    expect(await userCount('itest-invite-c@example.com')).toBe(0)
  })

  it('lets only one of two concurrent requests redeem the code', async () => {
    const code = await invite('itest-invite-d@example.com')
    const results = await Promise.allSettled([
      signUpWithInvite({ ...base, username: 'itestinvited1', email: 'itest-invite-d@example.com', code }),
      signUpWithInvite({ ...base, username: 'itestinvited2', email: 'itest-invite-d@example.com', code }),
    ])
    const created = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'created')
    expect(created).toHaveLength(1)
    expect(await userCount('itest-invite-d@example.com')).toBe(1)
  })

  it('rejects a wrong or missing code without creating a user or using the code', async () => {
    const code = await invite('itest-invite-e@example.com')
    const wrong = await signUpWithInvite({ ...base, username: 'itestinvitee1', email: 'itest-invite-e@example.com', code: 'not-the-code' })
    const missing = await signUpWithInvite({ ...base, username: 'itestinvitee2', email: 'itest-invite-e@example.com' })
    expect(wrong.status).toBe('invalid-code')
    expect(missing.status).toBe('invalid-code')
    expect(await userCount('itest-invite-e@example.com')).toBe(0)
    expect(await usedAt('itest-invite-e@example.com')).toBeNull()
    const ok = await signUpWithInvite({ ...base, username: 'itestinvitee3', email: 'itest-invite-e@example.com', code })
    expect(ok.status).toBe('created')
  })

  it('leaves the code unused when the username is taken', async () => {
    const code = await invite('itest-invite-f@example.com')
    await pool.query("INSERT INTO users (username, email, password) VALUES ('itestinvitef', 'itest-taken@example.com', 'x')")
    await expect(
      signUpWithInvite({ ...base, username: 'itestinvitef', email: 'itest-invite-f@example.com', code }),
    ).rejects.toThrow(/Username already in use/)
    expect(await usedAt('itest-invite-f@example.com')).toBeNull()
  })

  it('creates no user for an email without an invite', async () => {
    const result = await signUpWithInvite({ ...base, username: 'itestnoinvite', email: 'itest-noinvite@example.com', code: 'x' })
    expect(result.status).toBe('invalid-code')
    expect(await getInviteByEmail('itest-noinvite@example.com')).toBeNull()
    expect(await userCount('itest-noinvite@example.com')).toBe(0)
  })
})
