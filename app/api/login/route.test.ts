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
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/login', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockCookieSet.mockClear()
  })

  it('returns 400 if username is missing', async () => {
    const req = createRequest({ password: 'password123' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Username is required')
  })

  it('returns 400 if password is too short', async () => {
    const req = createRequest({ username: 'testuser', password: '123' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Password must be at least 8 characters')
  })

  it('returns 200 and sets cookie on successful login', async () => {
    const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
    (login as Mock).mockResolvedValue(mockUser);
    (encrypt as Mock).mockResolvedValue('mock-encrypted-token')

    const req = createRequest({ username: 'testuser', password: 'password123' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ username: 'testuser', email: 'test@example.com' })

    expect(login).toHaveBeenCalledWith('testuser', 'password123')
    expect(trackLoginAttempt).toHaveBeenCalledWith({ userId: 1, successful: true, ipAddress: 'unknown' })
    expect(encrypt).toHaveBeenCalled()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'session',
      'mock-encrypted-token',
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict' })
    )
  })

  it('returns 401 and tracks failed attempt on invalid credentials', async () => {
    (login as Mock).mockRejectedValue(new Error('Invalid username or password'))

    const req = createRequest({ username: 'testuser', password: 'wrongpassword' }, { 'x-forwarded-for': '10.0.0.1' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Invalid username or password')
    expect(trackLoginAttempt).toHaveBeenCalledWith({ userId: -1, successful: false, ipAddress: '10.0.0.1' })
  })

  it('returns 429 on too many failed attempts error', async () => {
    (login as Mock).mockRejectedValue(new Error('Too many failed login attempts. Please try again later.'))
    
    const req = createRequest({ username: 'testuser', password: 'password123' })
    const res = await POST(req)
    
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Too many failed login attempts. Please try again later.')
  })

})