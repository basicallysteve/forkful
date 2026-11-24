import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'

// The routes' `after()` needs a request scope, and no test may send email.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}))
const sendAccountEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email', () => ({
  sendWaitlistNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendUserAccountCreationEmail: (...a: unknown[]) => sendAccountEmail(...a),
}))

import { POST } from '../../app/api/users/route'
import { createInvite } from '@/lib/invites'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

function signup(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'StrongPass1!', cuisinePreferences: [], dietaryRestrictions: [], ...body }),
  }))
}

async function count(table: 'users' | 'waitlist_entries', email: string) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE lower(email) = lower($1)`, [email])
  return rows[0].n as number
}

describe('POST /api/users in both modes (#374)', () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    sendAccountEmail.mockClear()
    await pool.query("DELETE FROM users WHERE email LIKE 'itest%'")
    await pool.query("DELETE FROM invites WHERE email LIKE 'itest%'")
    await pool.query("DELETE FROM waitlist_entries WHERE email LIKE 'itest%'")
  })
  afterAll(() => pool.end())
  beforeAll(() => vi.stubEnv('AUTH_SECRET', 'itest-secret'))

  describe('invite-only on (waitlist mode)', () => {
    it('puts an uninvited email on the waitlist and creates no user', async () => {
      vi.stubEnv('INVITE_ONLY_ACCESS', 'true')
      const res = await signup({ username: 'itestwaiter', email: 'itest-wait@example.com' })
      expect(await res.json()).toEqual({ ok: true })
      expect(await count('users', 'itest-wait@example.com')).toBe(0)
      expect(await count('waitlist_entries', 'itest-wait@example.com')).toBe(1)
    })

    it('creates the user for an invited email with its code, and sends no account email', async () => {
      vi.stubEnv('INVITE_ONLY_ACCESS', 'true')
      const invite = await createInvite({ email: 'itest-invited@example.com' })
      if (invite.status !== 'created') throw new Error('invite not created')
      const res = await signup({ username: 'itestinvited', email: 'itest-invited@example.com', code: invite.code })
      expect(res.status).toBe(201)
      expect(await count('users', 'itest-invited@example.com')).toBe(1)
      expect(sendAccountEmail).not.toHaveBeenCalled()
    })
  })

  describe('invite-only off (open sign-up)', () => {
    it('creates the user for an uninvited email with no code, and notifies the admin', async () => {
      vi.stubEnv('INVITE_ONLY_ACCESS', 'false')
      const res = await signup({ username: 'itestopen', email: 'itest-open@example.com' })
      expect(res.status).toBe(201)
      expect(await count('users', 'itest-open@example.com')).toBe(1)
      expect(await count('waitlist_entries', 'itest-open@example.com')).toBe(0)
      expect(sendAccountEmail).toHaveBeenCalledWith('itestopen')
    })

    it('rejects a taken username', async () => {
      vi.stubEnv('INVITE_ONLY_ACCESS', 'false')
      await signup({ username: 'itestdupe', email: 'itest-dupe1@example.com' })
      const res = await signup({ username: 'itestdupe', email: 'itest-dupe2@example.com' })
      expect(res.status).toBe(400)
      expect(await count('users', 'itest-dupe2@example.com')).toBe(0)
    })
  })
})
