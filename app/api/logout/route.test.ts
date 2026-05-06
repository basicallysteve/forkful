import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockCookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    set: mockCookieSet,
  })),
}))

describe('POST /api/logout', () => {
  beforeEach(() => {
    mockCookieSet.mockClear()
  })

  it('returns 200 with success message', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toBe('Logged out successfully')
  })

  it('clears the session cookie', async () => {
    await POST()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'session',
      '',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        expires: new Date(0),
      })
    )
  })
})
