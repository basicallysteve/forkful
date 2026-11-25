import { describe, it, expect, vi, beforeEach } from 'vitest'

const afterCallbacks: Array<() => unknown> = []
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => unknown) => { afterCallbacks.push(fn) },
}))

const getSessionUser = vi.fn()
vi.mock('@/lib/auth', () => ({ getSessionUser: (...a: unknown[]) => getSessionUser(...a) }))
const createReviewReport = vi.fn()
vi.mock('@/lib/reviews', () => ({ createReviewReport: (...a: unknown[]) => createReviewReport(...a) }))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: (fn: () => unknown) => fn() } }))
const recordAdminEvent = vi.fn()
vi.mock('@/lib/adminSignals', () => ({ recordAdminEvent: (...a: unknown[]) => recordAdminEvent(...a) }))
vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), captureError: vi.fn() }))

import { POST } from './route'

const ctx = { params: Promise.resolve({ reviewId: '5' }) }
function req(body: unknown) {
  return new Request('http://localhost/api/reviews/5/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
async function flushAfter() {
  for (const fn of afterCallbacks.splice(0)) await fn()
}

beforeEach(() => {
  afterCallbacks.length = 0
  getSessionUser.mockReset().mockResolvedValue({ userId: 1 })
  createReviewReport.mockReset().mockResolvedValue(undefined)
  recordAdminEvent.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/reviews/[reviewId]/report', () => {
  it('records one review-report admin event after a report is filed, deferred with after()', async () => {
    const res = await POST(req({ reason: 'spam' }), ctx)
    expect(res.status).toBe(201)
    expect(recordAdminEvent).not.toHaveBeenCalled()
    await flushAfter()
    expect(recordAdminEvent).toHaveBeenCalledTimes(1)
    expect(recordAdminEvent).toHaveBeenCalledWith('review-report')
  })

  it('still answers success when recording the event fails', async () => {
    recordAdminEvent.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ reason: 'spam' }), ctx)
    expect(res.status).toBe(201)
    await expect(flushAfter()).resolves.toBeUndefined()
  })

  it('records no event when the report was not filed', async () => {
    createReviewReport.mockRejectedValue(new Error('You already reported this review'))
    const res = await POST(req({ reason: 'spam' }), ctx)
    expect(res.status).toBe(409)
    await flushAfter()
    expect(recordAdminEvent).not.toHaveBeenCalled()
  })

  it('records no event for an invalid reason', async () => {
    const res = await POST(req({ reason: 'nope' }), ctx)
    expect(res.status).toBe(400)
    await flushAfter()
    expect(recordAdminEvent).not.toHaveBeenCalled()
  })
})
