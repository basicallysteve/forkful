import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AdminEventKind, AdminSignalEvent } from '@/lib/adminEventKinds'

/** In-memory stand-in for the table, honoring the same claim contract as src/lib/adminEvents.ts. */
type Row = { id: number; kind: AdminEventKind; createdAt: Date; sentAt: Date | null }
const store = vi.hoisted(() => ({ rows: [] as Array<{ id: number; kind: string; createdAt: Date; sentAt: Date | null }>, nextId: 1 }))

vi.mock('@/lib/adminEvents', () => ({
  addAdminEvent: async (kind: AdminEventKind) => {
    store.rows.push({ id: store.nextId++, kind, createdAt: new Date(), sentAt: null })
  },
  claimDueAdminEvents: async (windowStart: Date) => {
    const rows = store.rows as Row[]
    if (rows.some((r) => r.sentAt && r.sentAt > windowStart)) return { ids: [], events: [], previousSentAt: null }
    const previous = rows.reduce<Date | null>((m, r) => (r.sentAt && (!m || r.sentAt > m) ? r.sentAt : m), null)
    const pending = rows.filter((r) => !r.sentAt)
    pending.forEach((r) => { r.sentAt = new Date() })
    return {
      ids: pending.map((r) => r.id),
      events: pending.map((r) => ({ kind: r.kind, createdAt: r.createdAt })),
      previousSentAt: previous,
    }
  },
  releaseAdminEvents: async (ids: number[]) => {
    ;(store.rows as Row[]).filter((r) => ids.includes(r.id)).forEach((r) => { r.sentAt = null })
  },
}))

const sent: Array<{ to: string; events: AdminSignalEvent[]; previousSentAt: Date | null }> = []
const sendAdminSignalEmail = vi.fn(async (args: { to: string; events: AdminSignalEvent[]; previousSentAt: Date | null }) => {
  sent.push(args)
})
vi.mock('@/lib/email', () => ({ sendAdminSignalEmail: (...a: Parameters<typeof sendAdminSignalEmail>) => sendAdminSignalEmail(...a) }))

const getUser = vi.fn()
vi.mock('@/lib/users', () => ({ getUser: (...a: unknown[]) => getUser(...a) }))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: (fn: () => unknown) => fn() } }))
vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), captureError: vi.fn() }))

import { recordAdminEvent, flushAdminEvents } from '@/lib/adminSignals'
import { captureError } from '@/lib/logger'

const MIN = 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-24T12:00:00Z'))
  store.rows.length = 0
  store.nextId = 1
  sent.length = 0
  sendAdminSignalEmail.mockClear()
  vi.mocked(captureError).mockClear()
  getUser.mockReset().mockResolvedValue({ id: 7, email: 'admin@example.com' })
  vi.stubEnv('ADMIN_USER_ID', '7')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const sentKinds = () => sent.flatMap((s) => s.events.map((e) => e.kind))

describe('recordAdminEvent', () => {
  it('sends the first event right away, to the admin, as its own email', async () => {
    await recordAdminEvent('review-report')
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('admin@example.com')
    expect(sent[0].events.map((e) => e.kind)).toEqual(['review-report'])
    expect(sent[0].previousSentAt).toBeNull()
  })

  it('holds a second event that arrives inside 15 minutes', async () => {
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 5 * MIN)
    await recordAdminEvent('feedback')
    expect(sent).toHaveLength(1)
    expect(store.rows.filter((r) => !r.sentAt)).toHaveLength(1)
  })

  it('sends one summary with every held event on the next event after the window', async () => {
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 3 * MIN)
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 3 * MIN)
    await recordAdminEvent('feedback')
    vi.setSystemTime(Date.now() + 15 * MIN)
    await recordAdminEvent('invite-accepted')
    expect(sent).toHaveLength(2)
    expect(sent[1].events.map((e) => e.kind).sort()).toEqual(['feedback', 'invite-accepted', 'review-report'])
    expect(sent[1].previousSentAt).toEqual(new Date('2026-11-24T12:00:00Z'))
  })

  it('a burst of N events sends one immediate email and one summary, each event exactly once', async () => {
    await recordAdminEvent('review-report')
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(Date.now() + MIN)
      await recordAdminEvent('review-report')
    }
    expect(sent).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(20 * MIN)
    await flushAdminEvents()
    expect(sent).toHaveLength(2)
    expect(sentKinds()).toHaveLength(7)
    expect(sent[0].events).toHaveLength(1)
    expect(sent[1].events).toHaveLength(6)
    expect(store.rows.every((r) => r.sentAt)).toBe(true)
  })

  it('concurrent events send at most one immediate email', async () => {
    await Promise.all([recordAdminEvent('review-report'), recordAdminEvent('review-report'), recordAdminEvent('feedback')])
    expect(sent).toHaveLength(1)
    // Every event is either in that one email or still pending, never in two emails.
    expect(sentKinds().length + store.rows.filter((r) => !r.sentAt).length).toBe(3)
  })

  it('never throws when the send fails, and keeps the event pending so it is not lost', async () => {
    sendAdminSignalEmail.mockRejectedValueOnce(new Error('resend down'))
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(captureError).toHaveBeenCalled()
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].sentAt).toBeNull()
  })

  it('retries a failed event on the next flush, once', async () => {
    sendAdminSignalEmail.mockRejectedValueOnce(new Error('resend down'))
    await recordAdminEvent('review-report')
    await flushAdminEvents()
    expect(sentKinds()).toEqual(['review-report'])
  })

  it('never throws when recording itself fails', async () => {
    getUser.mockRejectedValueOnce(new Error('db down'))
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(sent).toHaveLength(0)
  })

  it('does nothing when ADMIN_USER_ID is unset', async () => {
    vi.stubEnv('ADMIN_USER_ID', '')
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(sent).toHaveLength(0)
    expect(store.rows).toHaveLength(0)
  })

  it('does nothing when the admin user is missing', async () => {
    getUser.mockResolvedValue(null)
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(sent).toHaveLength(0)
    expect(store.rows).toHaveLength(0)
  })
})

describe('flushAdminEvents', () => {
  it('sends held events once the window has ended', async () => {
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 2 * MIN)
    await recordAdminEvent('feedback')
    vi.setSystemTime(Date.now() + 2 * MIN)
    await recordAdminEvent('feedback')
    expect(await flushAdminEvents()).toEqual({ sent: 0 })
    vi.setSystemTime(Date.now() + 15 * MIN)
    expect(await flushAdminEvents()).toEqual({ sent: 2 })
    expect(sent).toHaveLength(2)
    expect(sent[1].events).toHaveLength(2)
  })

  it('sends nothing when nothing is pending', async () => {
    expect(await flushAdminEvents()).toEqual({ sent: 0 })
    expect(sent).toHaveLength(0)
  })

  it('does not email a second time for events already sent', async () => {
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 30 * MIN)
    await flushAdminEvents()
    expect(sent).toHaveLength(1)
  })
})
