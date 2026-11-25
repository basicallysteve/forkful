import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import { addAdminEvent, claimDueAdminEvents, releaseAdminEvents } from './adminEvents'
import type { AdminEventKind } from './adminEventKinds'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({ connectionString })

// admin_events holds only notification bookkeeping (kind and times, no user data) and the claim
// depends on every row in the table, so each test starts from an empty table in the test database.
// Rows are tagged with an `itest-` kind so the cleanup is recognisable.
const kind = (name: string) => `itest-${name}` as AdminEventKind
const windowStart = () => new Date(Date.now() - 15 * 60 * 1000)

beforeEach(async () => {
  await pool.query('DELETE FROM admin_events')
})
afterAll(async () => {
  await pool.query("DELETE FROM admin_events WHERE kind LIKE 'itest-%'")
  await pool.end()
})

describe('claimDueAdminEvents', () => {
  it('claims a pending event and stamps it sent', async () => {
    await addAdminEvent(kind('a'))
    const claim = await claimDueAdminEvents(windowStart())
    expect(claim.events.map((e) => e.kind)).toEqual([kind('a')])
    expect(claim.previousSentAt).toBeNull()
    const { rows } = await pool.query('SELECT sent_at FROM admin_events')
    expect(rows[0].sent_at).toBeInstanceOf(Date)
  })

  it('claims nothing while an email went out inside the window, and the event stays pending', async () => {
    await addAdminEvent(kind('a'))
    await claimDueAdminEvents(windowStart())
    await addAdminEvent(kind('b'))
    const held = await claimDueAdminEvents(windowStart())
    expect(held.events).toEqual([])
    const { rows } = await pool.query('SELECT sent_at FROM admin_events WHERE kind = $1', [kind('b')])
    expect(rows[0].sent_at).toBeNull()
  })

  it('claims every held event together once the window has ended, and reports when the last email went out', async () => {
    await addAdminEvent(kind('a'))
    await claimDueAdminEvents(windowStart())
    await pool.query("UPDATE admin_events SET sent_at = now() - interval '20 minutes'")
    await addAdminEvent(kind('b'))
    await addAdminEvent(kind('c'))
    const claim = await claimDueAdminEvents(windowStart())
    expect(claim.events.map((e) => e.kind).sort()).toEqual([kind('b'), kind('c')])
    expect(claim.previousSentAt).toBeInstanceOf(Date)
    expect((await claimDueAdminEvents(windowStart())).events).toEqual([])
  })

  it('lets exactly one of many concurrent claimers send', async () => {
    for (const n of ['a', 'b', 'c', 'd', 'e']) await addAdminEvent(kind(n))
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimDueAdminEvents(windowStart())))
    const winners = claims.filter((c) => c.events.length > 0)
    expect(winners).toHaveLength(1)
    expect(winners[0].events).toHaveLength(5)
  })

  it('releases claimed events so they are pending again', async () => {
    await addAdminEvent(kind('a'))
    const claim = await claimDueAdminEvents(windowStart())
    await releaseAdminEvents(claim.ids)
    const again = await claimDueAdminEvents(windowStart())
    expect(again.events).toHaveLength(1)
  })
})
