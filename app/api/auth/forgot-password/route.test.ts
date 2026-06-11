import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { createPasswordResetToken, getOAuthProvidersForEmail, checkPasswordResetRateLimit, trackLoginAttempt } from '@/lib/users'
import { sendPasswordResetEmail } from '@/lib/email'

vi.mock('@/lib/users', () => ({
  createPasswordResetToken: vi.fn(),
  getOAuthProvidersForEmail: vi.fn(),
  checkPasswordResetRateLimit: vi.fn(),
  trackLoginAttempt: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}))

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(checkPasswordResetRateLimit as Mock).mockResolvedValue(undefined)
  ;(trackLoginAttempt as Mock).mockResolvedValue(undefined)
})

describe('POST /api/auth/forgot-password', () => {
  describe('rate limiting', () => {
    it('returns 400 when the rate limit is exceeded', async () => {
      (checkPasswordResetRateLimit as Mock).mockRejectedValue(
        new Error('Too many password reset requests. Please try again later.'),
      )

      const res = await POST(makeRequest({ email: 'user@example.com' }))

      expect(res.status).toBe(429)
      expect((await res.json()).error).toMatch(/too many/i)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('records an attempt before processing the email', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue({ token: 'tok', userId: 1 });
      (sendPasswordResetEmail as Mock).mockResolvedValue(undefined)

      await POST(makeRequest({ email: 'user@example.com' }))

      expect(trackLoginAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ successful: true }),
      )
    })
  })

  describe('input validation', () => {
    it('returns 400 when email is missing', async () => {
      const res = await POST(makeRequest({}))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/email/i)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('returns 400 when email is not a valid address', async () => {
      const res = await POST(makeRequest({ email: 'not-an-email' }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/email/i)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('returns 400 when email is an empty string', async () => {
      const res = await POST(makeRequest({ email: '' }))
      expect(res.status).toBe(400)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })

  describe('credential user', () => {
    it('sends a reset email and returns success', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue({ token: 'raw-token-abc', userId: 1 });
      (sendPasswordResetEmail as Mock).mockResolvedValue(undefined)

      const res = await POST(makeRequest({ email: 'user@example.com' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ type: 'success' })
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('raw-token-abc'),
      )
    })

    it('includes the token in the reset URL', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue({ token: 'tok-xyz', userId: 1 });
      (sendPasswordResetEmail as Mock).mockResolvedValue(undefined)

      await POST(makeRequest({ email: 'user@example.com' }))

      const [, url] = (sendPasswordResetEmail as Mock).mock.calls[0]
      expect(url).toContain('/reset-password?token=tok-xyz')
    })

    it('lowercases the email before processing', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue({ token: 'tok', userId: 1 });
      (sendPasswordResetEmail as Mock).mockResolvedValue(undefined)

      await POST(makeRequest({ email: 'User@Example.COM' }))

      expect(createPasswordResetToken).toHaveBeenCalledWith('user@example.com')
    })
  })

  describe('oauth-only user', () => {
    it('returns the provider list without sending an email', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue(null);
      (getOAuthProvidersForEmail as Mock).mockResolvedValue(['google'])

      const res = await POST(makeRequest({ email: 'oauth@example.com' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ type: 'oauth', providers: ['google'] })
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('returns multiple providers when the account has both google and apple', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue(null);
      (getOAuthProvidersForEmail as Mock).mockResolvedValue(['google', 'apple'])

      const res = await POST(makeRequest({ email: 'both@example.com' }))

      expect((await res.json()).providers).toEqual(['google', 'apple'])
    })
  })

  describe('unknown email', () => {
    it('returns success without sending an email (no enumeration)', async () => {
      (createPasswordResetToken as Mock).mockResolvedValue(null);
      (getOAuthProvidersForEmail as Mock).mockResolvedValue([])

      const res = await POST(makeRequest({ email: 'nobody@example.com' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ type: 'success' })
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })
})
