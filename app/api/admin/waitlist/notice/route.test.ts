import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
const mockSendNotices = vi.fn()
const mockCapture = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSessionUser: () => mockSession(),
  isAdmin: (id: number) => id === 1,
}))
vi.mock('@/lib/waitlistNotice', () => ({ sendWaitlistNotices: () => mockSendNotices() }))
vi.mock('@/lib/logger', () => ({ captureError: (...args: unknown[]) => mockCapture(...args) }))

import { POST, maxDuration } from './route'

beforeEach(() => {
  mockSession.mockReset().mockResolvedValue({ userId: 1 })
  mockSendNotices.mockReset().mockResolvedValue({ sent: 3, failed: 0 })
  mockCapture.mockReset()
})

describe('POST /api/admin/waitlist/notice', () => {
  it('returns 401 without a session and sends nothing', async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
    expect(mockSendNotices).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin and sends nothing', async () => {
    mockSession.mockResolvedValue({ userId: 2 })
    const res = await POST()
    expect(res.status).toBe(403)
    expect(mockSendNotices).not.toHaveBeenCalled()
  })

  it('returns the sent and failed counts for the admin', async () => {
    mockSendNotices.mockResolvedValue({ sent: 2, failed: 1 })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 2, failed: 1 })
  })

  it('returns a generic 500 and logs by area when the send throws', async () => {
    mockSendNotices.mockRejectedValue(new Error('db down for pat@example.com'))
    const res = await POST()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('pat@example.com')
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), { area: 'waitlist' })
  })

  it('allows up to 60 seconds, since it sends the emails one by one', () => {
    expect(maxDuration).toBe(60)
  })
})
