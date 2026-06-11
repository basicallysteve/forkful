import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { redeemPasswordResetToken, forceResetPassword } from '@/lib/users'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/users', () => ({
  redeemPasswordResetToken: vi.fn(),
  forceResetPassword: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

const STRONG_PASSWORD = 'Str0ng!Pass'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/reset-password', () => {
  describe('input validation', () => {
    it('returns 400 when newPassword is missing', async () => {
      const res = await POST(makeRequest({ token: 'tok' }))
      expect(res.status).toBe(400)
      expect(redeemPasswordResetToken).not.toHaveBeenCalled()
    })

    it('returns 400 when password is too short', async () => {
      const res = await POST(makeRequest({ token: 'tok', newPassword: 'Short1!' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when password has no uppercase letter', async () => {
      const res = await POST(makeRequest({ token: 'tok', newPassword: 'str0ng!pass' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when password has no number', async () => {
      const res = await POST(makeRequest({ token: 'tok', newPassword: 'StrongPass!' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when password has no special character', async () => {
      const res = await POST(makeRequest({ token: 'tok', newPassword: 'Str0ngPass' }))
      expect(res.status).toBe(400)
    })
  })

  describe('token mode', () => {
    it('redeems the token and returns success', async () => {
      (redeemPasswordResetToken as Mock).mockResolvedValue(undefined)

      const res = await POST(makeRequest({ token: 'raw-tok', newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ type: 'success' })
      expect(redeemPasswordResetToken).toHaveBeenCalledWith('raw-tok', STRONG_PASSWORD)
      expect(forceResetPassword).not.toHaveBeenCalled()
    })

    it('returns 400 when the token has already been used', async () => {
      (redeemPasswordResetToken as Mock).mockRejectedValue(new Error('This reset link has already been used'))

      const res = await POST(makeRequest({ token: 'used-tok', newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/already been used/i)
    })

    it('returns 400 when the token has expired', async () => {
      (redeemPasswordResetToken as Mock).mockRejectedValue(new Error('This reset link has expired'))

      const res = await POST(makeRequest({ token: 'old-tok', newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/expired/i)
    })

    it('returns 400 when the token is invalid', async () => {
      (redeemPasswordResetToken as Mock).mockRejectedValue(new Error('Invalid or expired reset link'))

      const res = await POST(makeRequest({ token: 'bad-tok', newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(400)
    })
  })

  describe('forced mode (no token)', () => {
    it('returns 401 when there is no session', async () => {
      (getSessionUser as Mock).mockResolvedValue(null)

      const res = await POST(makeRequest({ newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(401)
      expect(forceResetPassword).not.toHaveBeenCalled()
    })

    it('resets the password for the session user and returns passwordChangedAt', async () => {
      (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
      (forceResetPassword as Mock).mockResolvedValue(undefined)

      const res = await POST(makeRequest({ newPassword: STRONG_PASSWORD }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.type).toBe('success')
      expect(body.passwordChangedAt).toBeDefined()
      expect(forceResetPassword).toHaveBeenCalledWith(42, STRONG_PASSWORD)
      expect(redeemPasswordResetToken).not.toHaveBeenCalled()
    })

    it('returns a valid ISO timestamp for passwordChangedAt', async () => {
      (getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'bob' });
      (forceResetPassword as Mock).mockResolvedValue(undefined)

      const res = await POST(makeRequest({ newPassword: STRONG_PASSWORD }))
      const { passwordChangedAt } = await res.json()

      expect(new Date(passwordChangedAt).toString()).not.toBe('Invalid Date')
    })
  })
})
