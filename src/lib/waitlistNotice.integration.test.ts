import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import { sendWaitlistNotices } from './waitlistNotice'

// `withTimeout` is replaced so a test can make a send time out at once.
const timeoutMode = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/withTimeout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/withTimeout')>()
  return {
    ...actual,
    withTimeout: <T,>(promise: Promise<T>, ms: number) =>
      timeoutMode.on ? Promise.reject(new actual.TimeoutError(ms)) : actual.withTimeout(promise, ms),
  }
})

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

async function addUser(name: string, over: { deleted?: boolean } = {}): Promise<number> {
  const { rows } = await pool.query(
    'INSERT INTO users (username, email, date_deleted) VALUES ($1, $2, $3) RETURNING id',
    [`itest-wn-${name}`, `itest-wn-${name}@example.com`, over.deleted ? new Date() : null],
  )
  return rows[0].id
}
const sentAt = async (name: string) =>
  (await pool.query('SELECT waitlist_notice_sent_at FROM users WHERE username = $1', [`itest-wn-${name}`])).rows[0].waitlist_notice_sent_at as Date | null

describe('sendWaitlistNotices', () => {
  // The notice email carries a leave token signed with AUTH_SECRET, which CI does not have: without
  // it every send throws and nothing counts as sent. Use a test secret.
  beforeAll(() => {
    vi.stubEnv('AUTH_SECRET', 'itest-secret')
  })
  afterEach(async () => {
    timeoutMode.on = false
    vi.unstubAllEnvs()
    vi.stubEnv('AUTH_SECRET', 'itest-secret')
    await pool.query("DELETE FROM invites WHERE email LIKE 'itest-wn-%'")
    await pool.query("DELETE FROM users WHERE username LIKE 'itest-wn-%'")
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.end()
  })

  it('notices each Waitlisted User once, then nothing, then only a User who became Waitlisted later', async () => {
    await addUser('a')
    await addUser('b')
    await addUser('c')

    const first = await sendWaitlistNotices()
    expect(first.sent).toBeGreaterThanOrEqual(3)
    expect(first.failed).toBe(0)
    for (const name of ['a', 'b', 'c']) expect(await sentAt(name)).toBeInstanceOf(Date)

    expect(await sendWaitlistNotices()).toEqual({ sent: 0, failed: 0 })

    await addUser('d')
    expect(await sendWaitlistNotices()).toEqual({ sent: 1, failed: 0 })
    expect(await sentAt('d')).toBeInstanceOf(Date)
  })

  it('skips invited Users and deactivated Users, and does not stamp them', async () => {
    await addUser('invited')
    await pool.query("INSERT INTO invites (email, code_hash) VALUES ('itest-wn-invited@example.com', $1)", ['0'.repeat(64)])
    await addUser('gone', { deleted: true })

    await sendWaitlistNotices()
    expect(await sentAt('invited')).toBeNull()
    expect(await sentAt('gone')).toBeNull()
  })

  it('does nothing when invite-only is off: sends 0 and stamps nobody', async () => {
    await addUser('open')
    vi.stubEnv('INVITE_ONLY_ACCESS', 'false')

    expect(await sendWaitlistNotices()).toEqual({ sent: 0, failed: 0 })
    expect(await sentAt('open')).toBeNull()
  })

  it('keeps the stamp when a send times out, so a retry does not email them twice', async () => {
    await addUser('slow')
    timeoutMode.on = true

    const result = await sendWaitlistNotices()
    expect(result.failed).toBe(0)
    expect(await sentAt('slow')).toBeInstanceOf(Date)
  })
})
