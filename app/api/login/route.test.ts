import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { login, trackLoginAttempt } from '@/lib/users'
import { encrypt } from '@/lib/session'

vi.mock('@/lib/users', () => ({
  login: vi.fn(),
  trackLoginAttempt: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  encrypt: vi.fn(),
  SESSION_DURATION_MS: 60 * 60 * 1000,
}))

const mockCookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    set: mockCookieSet,
  })),
}))

function createRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if username is missing', async () => {
    const res = await POST(createRequest({ password: 'password123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Username is required')
  })

  it('returns 400 if password is too short', async () => {
    const res = await POST(createRequest({ username: 'testuser', password: '123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Password must be at least 8 characters')
  })

  it('returns 200, sets cookie, and returns username+email on success', async () => {
    const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
    (login as Mock).mockResolvedValue(mockUser);
    (encrypt as Mock).mockResolvedValue('mock-encrypted-token')

    const res = await POST(createRequest({ username: 'testuser', password: 'password123' }, { 'x-forwarded-for': '1.2.3.4' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ username: 'testuser', email: 'test@example.com' })

    expect(login).toHaveBeenCalledWith('testuser', 'password123', '1.2.3.4')
    expect(trackLoginAttempt).toHaveBeenCalledWith({ userId: 1, successful: true, ipAddress: '1.2.3.4' })
    expect(mockCookieSet).toHaveBeenCalledWith(
      'session',
      'mock-encrypted-token',
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict' })
    )
  })

  it('passes the first x-forwarded-for IP to login', async () => {
    (login as Mock).mockRejectedValue(new Error('Invalid username or password'))

    await POST(createRequest({ username: 'u', password: 'password123' }, { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' }))

    expect(login).toHaveBeenCalledWith(expect.any(String), expect.any(String), '5.5.5.5')
  })

  it('returns 401 on invalid credentials and does not call trackLoginAttempt (tracking is handled inside login())', async () => {
    (login as Mock).mockRejectedValue(new Error('Invalid username or password'))

    const res = await POST(createRequest({ username: 'testuser', password: 'wrongpassword' }, { 'x-forwarded-for': '10.0.0.1' }))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid username or password')
    expect(trackLoginAttempt).not.toHaveBeenCalled()
  })

  it('returns 429 on too many failed attempts and does not track another attempt', async () => {
    (login as Mock).mockRejectedValue(new Error('Too many failed login attempts. Please try again later.'))

    const res = await POST(createRequest({ username: 'testuser', password: 'password123' }))

    expect(res.status).toBe(429)
    expect(trackLoginAttempt).not.toHaveBeenCalled()
  })
})
