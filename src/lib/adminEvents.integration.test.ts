import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'
import { parseEnvFile } from '@/db/resolveDrizzleEnv'
import { addAdminEvent, claimDueAdminEvents, failAdminEvents } from './adminEvents'
import type { AdminEventKind } from './adminEventKinds'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const URL_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL']
const hostOf = (value: string | undefined) => {
  if (!value) return undefined
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

/** This suite writes and deletes rows: never let it run against the production database. */
function assertNotProduction(url: string) {
  // Resolved from this file, so it works from any cwd or worktree. Inert only if the file is absent (CI).
  const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.production')
  if (!existsSync(file)) return
  const prod = parseEnvFile(readFileSync(file, 'utf8'))
  const prodUrls = URL_KEYS.map((key) => prod[key]).filter(Boolean)
  const prodHosts = new Set(
    [...prodUrls.map(hostOf), prod.DATABASE_HOST?.toLowerCase()].filter((host): host is string => !!host),
  )
  const targetHosts = [hostOf(url), process.env.DATABASE_HOST?.toLowerCase()].filter((host): host is string => !!host)
  if (prodUrls.includes(url) || targetHosts.some((host) => prodHosts.has(host))) {
    throw new Error('Refusing to run integration tests against the production database.')
  }
}
assertNotProduction(connectionString)

const pool = new Pool({ connectionString })

// Everything here is scoped to rows whose type starts with `itest-`: the claim takes the list of
// types it works on, so other rows in the table are never read, claimed or deleted.
const type = (name: string) => `itest-${name}` as AdminEventKind
const TYPES = ['a', 'b', 'c', 'd', 'e'].map(type)
const windowStart = () => new Date(Date.now() - 15 * 60 * 1000)
const claim = (start = windowStart(), now?: Date) => claimDueAdminEvents(start, TYPES, now)
const DAY = 24 * 60 * 60 * 1000

beforeAll(() => {
  assertNotProduction(connectionString)
})
beforeEach(async () => {
  await pool.query("DELETE FROM events WHERE type LIKE 'itest-%'")
})
afterAll(async () => {
  await pool.query("DELETE FROM events WHERE type LIKE 'itest-%'")
  await pool.end()
})

describe('claimDueAdminEvents', () => {
  it('claims a pending event and stamps it sent', async () => {
    await addAdminEvent(type('a'))
    const result = await claim()
    expect(result.events.map((e) => e.kind)).toEqual([type('a')])
    const { rows } = await pool.query("SELECT status, sent_at FROM events WHERE type = $1", [type('a')])
    expect(rows[0].status).toBe('sent')
    expect(rows[0].sent_at).toBeInstanceOf(Date)
  })

  it('claims nothing while an email went out inside the window, and the event stays pending', async () => {
    await addAdminEvent(type('a'))
    await claim()
    await addAdminEvent(type('b'))
    expect((await claim()).events).toEqual([])
    const { rows } = await pool.query('SELECT status, sent_at FROM events WHERE type = $1', [type('b')])
    expect(rows[0]).toMatchObject({ status: 'pending', sent_at: null })
  })

  it('claims every held event together once the window has ended', async () => {
    await addAdminEvent(type('a'))
    await claim()
    await pool.query("UPDATE events SET sent_at = now() - interval '20 minutes' WHERE type LIKE 'itest-%'")
    await addAdminEvent(type('b'))
    await addAdminEvent(type('c'))
    const result = await claim()
    expect(result.events.map((e) => e.kind).sort()).toEqual([type('b'), type('c')])
    expect((await claim()).events).toEqual([])
  })

  it('lets exactly one of many concurrent claimers send', async () => {
    for (const t of TYPES) await addAdminEvent(t)
    const claims = await Promise.all(Array.from({ length: 8 }, () => claim()))
    const winners = claims.filter((c) => c.events.length > 0)
    expect(winners).toHaveLength(1)
    expect(winners[0].events).toHaveLength(5)
  })

  it('ignores rows of other types, both when claiming and for the cap', async () => {
    await pool.query("INSERT INTO events (type, status, sent_at) VALUES ('itest-other', 'sent', now())")
    await pool.query("INSERT INTO events (type) VALUES ('itest-other')")
    await addAdminEvent(type('a'))
    const result = await claim()
    expect(result.events.map((e) => e.kind)).toEqual([type('a')])
    const { rows } = await pool.query("SELECT status FROM events WHERE type = 'itest-other' AND sent_at IS NULL")
    expect(rows[0].status).toBe('pending')
  })
})

describe('failAdminEvents', () => {
  it('puts the event back to pending with an attempt, the error and a retry time a day out', async () => {
    await addAdminEvent(type('a'))
    const { ids } = await claim()
    const now = new Date()
    const { terminalIds } = await failAdminEvents(ids, 'resend down', now)
    expect(terminalIds).toEqual([])
    // Columns are timestamp without time zone, stored as UTC: read the epoch so the client's zone can't skew it.
    const { rows } = await pool.query('SELECT status, attempts, last_error, sent_at, extract(epoch from next_attempt_at) * 1000 AS next_ms FROM events WHERE type = $1', [type('a')])
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 1, last_error: 'resend down', sent_at: null })
    expect(Number(rows[0].next_ms)).toBe(now.getTime() + DAY)
  })

  it('a failure does not consume the cap, and the event is not claimed again before its retry time', async () => {
    await addAdminEvent(type('a'))
    const { ids } = await claim()
    await failAdminEvents(ids, 'resend down')
    await addAdminEvent(type('b'))
    const next = await claim()
    expect(next.events.map((e) => e.kind)).toEqual([type('b')])
  })

  it('claims a failed event again once next_attempt_at has passed', async () => {
    await addAdminEvent(type('a'))
    const { ids } = await claim()
    await failAdminEvents(ids, 'resend down')
    const later = new Date(Date.now() + DAY + 1000)
    const result = await claim(new Date(later.getTime() - 15 * 60 * 1000), later)
    expect(result.ids).toEqual(ids)
  })

  it('marks the event failed for good on the fifth attempt and never claims it again', async () => {
    await addAdminEvent(type('a'))
    let outcome = { terminalIds: [] as number[] }
    let when = new Date()
    for (let i = 0; i < 5; i++) {
      const { ids } = await claim(new Date(when.getTime() - 15 * 60 * 1000), when)
      expect(ids).toHaveLength(1)
      outcome = await failAdminEvents(ids, `try ${i + 1}`, when)
      when = new Date(when.getTime() + 30 * DAY)
    }
    expect(outcome.terminalIds).toHaveLength(1)
    const { rows } = await pool.query('SELECT status, attempts, next_attempt_at FROM events WHERE type = $1', [type('a')])
    expect(rows[0]).toMatchObject({ status: 'failed', attempts: 5, next_attempt_at: null })
    expect((await claim(new Date(when.getTime() - 15 * 60 * 1000), when)).events).toEqual([])
  })
})
