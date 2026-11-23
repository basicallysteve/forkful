import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createInvite, revokeInvite, hashInviteCode } from './invites'
import { listWaitlist, deleteWaitlistEntry } from './waitlist'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

async function addEntry(email: string, optIn = false): Promise<number> {
  const { rows } = await pool.query(
    'INSERT INTO waitlist_entries (email, name, marketing_email_opt_in) VALUES ($1, $2, $3) RETURNING id',
    [email, 'ITest', optIn],
  )
  return rows[0].id
}
const inviteRows = async (email: string) =>
  (await pool.query('SELECT * FROM invites WHERE lower(email) = lower($1)', [email])).rows

describe('waitlist admin data layer', () => {
  afterEach(async () => {
    await pool.query("DELETE FROM invites WHERE email LIKE 'itest%'")
    await pool.query("DELETE FROM waitlist_entries WHERE email LIKE 'itest%'")
    await pool.query("DELETE FROM users WHERE email LIKE 'itest-wl%'")
  })
  afterAll(async () => {
    await pool.end()
  })

  it('invites by entry id: stores only the hash, returns the raw code, leaves code unused', async () => {
    const entryId = await addEntry('itest-a@example.com')
    const result = await createInvite({ entryId })
    expect(result.status).toBe('created')
    if (result.status !== 'created') return
    expect(result.email).toBe('itest-a@example.com')
    const rows = await inviteRows('itest-a@example.com')
    expect(rows).toHaveLength(1)
    expect(rows[0].code_hash).toBe(hashInviteCode(result.code))
    expect(rows[0].code_hash).not.toBe(result.code)
    expect(rows[0].code_used_at).toBeNull()
  })

  it('invites a typed email that is not on the waitlist without creating an entry', async () => {
    const result = await createInvite({ email: 'ITest-Typed@Example.com' })
    expect(result.status).toBe('created')
    expect(await inviteRows('itest-typed@example.com')).toHaveLength(1)
    const entries = await pool.query("SELECT 1 FROM waitlist_entries WHERE lower(email) = 'itest-typed@example.com'")
    expect(entries.rowCount).toBe(0)
  })

  it('reports already invited (any casing) and creates no second Invite', async () => {
    await createInvite({ email: 'itest-dup@example.com' })
    const again = await createInvite({ email: 'ITEST-DUP@example.com' })
    expect(again).toEqual({ status: 'already-invited' })
    expect(await inviteRows('itest-dup@example.com')).toHaveLength(1)
  })

  it('returns entry-not-found for an unknown entry id', async () => {
    expect(await createInvite({ entryId: 2147483000 })).toEqual({ status: 'entry-not-found' })
  })

  it('lists newest first with invited and has-account flags, and never exposes the code hash', async () => {
    const older = await addEntry('itest-old@example.com', true)
    await pool.query("UPDATE waitlist_entries SET date_added = now() - interval '2 days' WHERE id = $1", [older])
    const mid = await addEntry('itest-new@example.com')
    await pool.query("UPDATE waitlist_entries SET date_added = now() - interval '1 day' WHERE id = $1", [mid])
    await pool.query("INSERT INTO users (username, email) VALUES ('itest-wl-user', 'ITEST-WL-user@example.com')")
    await addEntry('itest-wl-user@example.com')
    await createInvite({ email: 'itest-old@example.com' })

    const list = (await listWaitlist()).filter((e) => e.email.startsWith('itest'))
    expect(list.map((e) => e.email)).toEqual(['itest-wl-user@example.com', 'itest-new@example.com', 'itest-old@example.com'])
    const byEmail = Object.fromEntries(list.map((e) => [e.email, e]))
    expect(byEmail['itest-old@example.com']).toMatchObject({ invited: true, hasAccount: false, marketingEmailOptIn: true })
    expect(byEmail['itest-old@example.com'].inviteId).toEqual(expect.any(Number))
    expect(byEmail['itest-new@example.com']).toMatchObject({ invited: false, inviteId: null, hasAccount: false })
    expect(byEmail['itest-wl-user@example.com'].hasAccount).toBe(true)
    expect(JSON.stringify(list)).not.toMatch(/code/i)
  })

  it('revoke removes the Invite and leaves the entry and any user alone', async () => {
    await pool.query("INSERT INTO users (username, email) VALUES ('itest-wl-keep', 'itest-wl-keep@example.com')")
    await addEntry('itest-wl-keep@example.com')
    const result = await createInvite({ email: 'itest-wl-keep@example.com' })
    if (result.status !== 'created') throw new Error('expected created')
    expect(await revokeInvite(result.inviteId)).toBe(true)
    expect(await inviteRows('itest-wl-keep@example.com')).toHaveLength(0)
    expect(await revokeInvite(result.inviteId)).toBe(false)
    expect((await pool.query("SELECT 1 FROM users WHERE email = 'itest-wl-keep@example.com'")).rowCount).toBe(1)
    expect((await pool.query("SELECT 1 FROM waitlist_entries WHERE email = 'itest-wl-keep@example.com'")).rowCount).toBe(1)
  })

  it('creating an Invite never changes users', async () => {
    await pool.query("INSERT INTO users (username, email) VALUES ('itest-wl-u2', 'itest-wl-u2@example.com')")
    const before = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n
    await createInvite({ email: 'itest-wl-u2@example.com' })
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(before)
  })

  it('deleting an entry leaves the user and any Invite intact', async () => {
    await pool.query("INSERT INTO users (username, email) VALUES ('itest-wl-u3', 'itest-wl-u3@example.com')")
    const id = await addEntry('itest-wl-u3@example.com')
    await createInvite({ email: 'itest-wl-u3@example.com' })
    expect(await deleteWaitlistEntry(id)).toBe(true)
    expect(await deleteWaitlistEntry(id)).toBe(false)
    expect((await pool.query("SELECT 1 FROM users WHERE email = 'itest-wl-u3@example.com'")).rowCount).toBe(1)
    expect(await inviteRows('itest-wl-u3@example.com')).toHaveLength(1)
  })
})
