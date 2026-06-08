import { describe, it, expect, vi } from 'vitest'

const mockSignOut = vi.fn().mockResolvedValue(undefined)

vi.mock('@/auth', () => ({
  get signOut() { return mockSignOut },
}))

import { POST } from './route'

describe('POST /api/logout', () => {
  it('calls signOut and returns 200 with success message', async () => {
    const res = await POST()
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toBe('Logged out successfully')
  })
})
