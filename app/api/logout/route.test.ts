import { describe, it, expect, vi } from 'vitest'

vi.mock('@/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'

describe('POST /api/logout', () => {
  it('returns 200 with success message', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toBe('Logged out successfully')
  })
})
