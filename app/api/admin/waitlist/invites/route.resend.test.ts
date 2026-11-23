import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Exercises the real sendInviteEmail + deliver path; only Resend itself is faked.
const send = vi.fn()
const mockCapture = vi.fn()
vi.mock('resend', () => ({ Resend: class { emails = { send } } }))
vi.mock('@/lib/auth', () => ({ getSessionUser: async () => ({ userId: 1 }), isAdmin: () => true }))
vi.mock('@/lib/invites', () => ({
  createInvite: async () => ({ status: 'created', inviteId: 9, email: 'pat@example.com', code: 'RAWCODE' }),
}))
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  captureError: (...args: unknown[]) => mockCapture(...args),
}))

import { POST } from './route'

function req() {
  return new Request('http://localhost/api/admin/waitlist/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pat@example.com' }),
  })
}

beforeEach(() => {
  send.mockReset()
  mockCapture.mockReset()
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('RESEND_API_KEY', 'prod-key')
  vi.stubEnv('AUTH_URL', 'https://app.example.com')
})
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/admin/waitlist/invites when Resend resolves an error', () => {
  it('reports emailSent false, keeps the Invite and returns the code once, uncached', async () => {
    send.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', message: 'to pat@example.com RAWCODE', statusCode: 429 } })
    const res = await POST(req())
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ inviteId: 9, email: 'pat@example.com', code: 'RAWCODE', emailSent: false })
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('logs the failure by area only, with no address or code in the error', async () => {
    send.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', message: 'to pat@example.com RAWCODE', statusCode: 429 } })
    await POST(req())
    expect(mockCapture).toHaveBeenCalledTimes(1)
    const [error, options] = mockCapture.mock.calls[0]
    expect(options).toEqual({ area: 'waitlist' })
    expect(String((error as Error).message)).not.toMatch(/RAWCODE|pat@example/)
  })

  it('reports emailSent true when Resend accepts the send', async () => {
    send.mockResolvedValue({ data: { id: 'x' }, error: null })
    const res = await POST(req())
    expect((await res.json()).emailSent).toBe(true)
  })
})
