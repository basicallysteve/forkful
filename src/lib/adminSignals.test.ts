import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AdminEventKind, AdminSignalEvent } from '@/lib/adminEventKinds'

type Row = {
  id: number
  type: AdminEventKind
  createdAt: Date
  sentAt: Date | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  lastError: string | null
  nextAttemptAt: Date | null
}
const store = vi.hoisted(() => ({ rows: [] as unknown[], nextId: 1 }))
const rows = () => store.rows as Row[]

/** In-memory stand-in for the events table, honoring the same contract as src/lib/adminEvents.ts. */
vi.mock('@/lib/adminEvents', async () => {
  const retry = await vi.importActual<typeof import('@/lib/adminEventRetry')>('@/lib/adminEventRetry')
  return {
    addAdminEvent: async (type: AdminEventKind) => {
      rows().push({ id: store.nextId++, type, createdAt: new Date(), sentAt: null, status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null })
    },
    claimDueAdminEvents: async (windowStart: Date) => {
      const now = new Date()
      if (rows().some((r) => r.sentAt && r.sentAt > windowStart)) return { ids: [], events: [] }
      const due = rows().filter((r) => r.status === 'pending' && (!r.nextAttemptAt || r.nextAttemptAt <= now))
      due.forEach((r) => { r.status = 'sent'; r.sentAt = now })
      return { ids: due.map((r) => r.id), events: due.map((r) => ({ kind: r.type, createdAt: r.createdAt })) }
    },
    failAdminEvents: async (ids: number[], error: string) => {
      const now = new Date()
      const terminalIds: number[] = []
      for (const r of rows().filter((x) => ids.includes(x.id))) {
        const outcome = retry.outcomeAfterFailure(r.attempts, now)
        Object.assign(r, { attempts: outcome.attempts, status: outcome.status, nextAttemptAt: outcome.nextAttemptAt, lastError: error, sentAt: null })
        if (outcome.status === 'failed') terminalIds.push(r.id)
      }
      return { terminalIds }
    },
  }
})

const sent: Array<{ to: string; events: AdminSignalEvent[] }> = []
const sendAdminSignalEmail = vi.fn(async (args: { to: string; events: AdminSignalEvent[] }) => {
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
const DAY = 24 * 60 * MIN

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-24T12:00:00Z'))
  store.rows.length = 0
  store.nextId = 1
  sent.length = 0
  sendAdminSignalEmail.mockReset().mockImplementation(async (args) => { sent.push(args) })
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
    expect(rows()[0].status).toBe('sent')
  })

  it('holds a second event that arrives inside 15 minutes', async () => {
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 5 * MIN)
    await recordAdminEvent('feedback')
    expect(sent).toHaveLength(1)
    expect(rows().filter((r) => r.status === 'pending')).toHaveLength(1)
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
    expect(rows().every((r) => r.status === 'sent')).toBe(true)
  })

  it('concurrent events send at most one immediate email', async () => {
    await Promise.all([recordAdminEvent('review-report'), recordAdminEvent('review-report'), recordAdminEvent('feedback')])
    expect(sent).toHaveLength(1)
    expect(sentKinds().length + rows().filter((r) => r.status === 'pending').length).toBe(3)
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
    expect(rows()).toHaveLength(0)
  })

  it('does nothing when the admin user is missing', async () => {
    getUser.mockResolvedValue(null)
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(sent).toHaveLength(0)
    expect(rows()).toHaveLength(0)
  })
})

describe('a failed send', () => {
  it('never throws, keeps the event, and records the attempt and the error', async () => {
    sendAdminSignalEmail.mockRejectedValueOnce(new Error('resend down'))
    await expect(recordAdminEvent('review-report')).resolves.toBeUndefined()
    expect(captureError).toHaveBeenCalled()
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({ status: 'pending', attempts: 1, sentAt: null })
    expect(rows()[0].lastError).toContain('resend down')
    expect(rows()[0].nextAttemptAt).toEqual(new Date(Date.now() + DAY))
  })

  it('does not consume the 15-minute cap: the next event still goes out at once', async () => {
    sendAdminSignalEmail.mockRejectedValueOnce(new Error('resend down'))
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + MIN)
    await recordAdminEvent('feedback')
    expect(sentKinds()).toEqual(['feedback'])
  })

  it('counts a timed-out send as a failure and retries it', async () => {
    sendAdminSignalEmail.mockImplementationOnce(() => new Promise(() => {}))
    const recording = recordAdminEvent('review-report')
    await vi.advanceTimersByTimeAsync(10_000)
    await recording
    expect(rows()[0]).toMatchObject({ status: 'pending', attempts: 1, sentAt: null })
    expect(rows()[0].lastError).toContain('Timed out')
  })

  it('is not retried before next_attempt_at, then goes out on the first flush after it', async () => {
    sendAdminSignalEmail.mockRejectedValueOnce(new Error('resend down'))
    await recordAdminEvent('review-report')
    vi.setSystemTime(Date.now() + 6 * 60 * MIN)
    expect(await flushAdminEvents()).toEqual({ sent: 0 })
    vi.setSystemTime(Date.now() + 19 * 60 * MIN)
    expect(await flushAdminEvents()).toEqual({ sent: 1 })
    expect(sentKinds()).toEqual(['review-report'])
    expect(rows()[0].status).toBe('sent')
  })

  it('backs off 1 day, 2 days, then 4 days between attempts', async () => {
    sendAdminSignalEmail.mockRejectedValue(new Error('resend down'))
    const waits: number[] = []
    await recordAdminEvent('review-report')
    for (let i = 0; i < 3; i++) {
      waits.push(rows()[0].nextAttemptAt!.getTime() - Date.now())
      vi.setSystemTime(rows()[0].nextAttemptAt!.getTime())
      await flushAdminEvents()
    }
    expect(waits).toEqual([DAY, 2 * DAY, 4 * DAY])
  })

  it('after 5 attempts is marked failed for good and reported to Sentry', async () => {
    sendAdminSignalEmail.mockRejectedValue(new Error('resend down'))
    await recordAdminEvent('review-report')
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(rows()[0].nextAttemptAt!.getTime())
      await flushAdminEvents()
    }
    expect(rows()[0]).toMatchObject({ status: 'failed', attempts: 5, nextAttemptAt: null })
    const reported = vi.mocked(captureError).mock.calls.map(([e]) => (e instanceof Error ? e.message : String(e)))
    expect(reported.some((m) => m.includes('gave up'))).toBe(true)

    sendAdminSignalEmail.mockClear()
    vi.setSystemTime(Date.now() + 60 * DAY)
    expect(await flushAdminEvents()).toEqual({ sent: 0 })
    expect(sendAdminSignalEmail).not.toHaveBeenCalled()
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
