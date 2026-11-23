import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSessionUser: () => mockSession(),
  isAdmin: (id: number) => id === 1,
}))
vi.mock('@/lib/invites', () => ({ revokeInvite: (...args: unknown[]) => mockRemove(...args) }))

import { DELETE } from './route'

const call = (id: string) => DELETE(new Request('http://localhost/x', { method: 'DELETE' }), { params: Promise.resolve({ id }) })

beforeEach(() => {
  mockSession.mockReset().mockResolvedValue({ userId: 1 })
  mockRemove.mockReset().mockResolvedValue(true)
})

describe('DELETE /api/admin/waitlist/invites/[id]', () => {
  it('returns 401 without a session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await call('5')).status).toBe(401)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin', async () => {
    mockSession.mockResolvedValue({ userId: 2 })
    expect((await call('5')).status).toBe(403)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric id', async () => {
    expect((await call('abc')).status).toBe(400)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('returns 400 for ids outside the int4 range', async () => {
    for (const id of ['0', '-3', '2147483648', '1.5']) {
      expect((await call(id)).status).toBe(400)
    }
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('revokes the Invite for the admin', async () => {
    const res = await call('5')
    expect(res.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith(5)
  })

  it('returns 404 when nothing was removed', async () => {
    mockRemove.mockResolvedValue(false)
    expect((await call('5')).status).toBe(404)
  })
})
