import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
const mockList = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSessionUser: () => mockSession(),
  isAdmin: (id: number) => id === 1,
}))
vi.mock('@/lib/waitlist', () => ({ listWaitlist: () => mockList() }))

import { GET } from './route'

beforeEach(() => {
  mockSession.mockReset()
  mockList.mockReset().mockResolvedValue([])
})

describe('GET /api/admin/waitlist', () => {
  it('returns 401 without a session and does not read the list', async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin', async () => {
    mockSession.mockResolvedValue({ userId: 2 })
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('returns the entries for the admin', async () => {
    mockSession.mockResolvedValue({ userId: 1 })
    const entries = [{ entryId: null, email: 'a@example.com', name: null, marketingEmailOptIn: true, dateAdded: '2026-11-23T00:00:00.000Z', inviteId: null, invited: false, hasAccount: false }]
    mockList.mockResolvedValue(entries)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(entries)
  })
})
