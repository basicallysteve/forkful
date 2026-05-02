import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiSignUp, apiLogin, apiLogout } from './users'

const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiSignUp', () => {
  it('posts sign-up data and returns created user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as Response)

    const result = await apiSignUp({
      username: 'testuser',
      email: 'test@example.com',
      password: 'StrongPass1!',
    })

    expect(result).toEqual(mockUser)
    expect(fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws with server error message on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Email already in use' }),
    } as Response)

    await expect(
      apiSignUp({ username: 'testuser', email: 'taken@example.com', password: 'StrongPass1!' })
    ).rejects.toThrow('Email already in use')
  })

  it('throws generic message when error body cannot be parsed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('invalid json') },
    } as unknown as Response)

    await expect(
      apiSignUp({ username: 'testuser', email: 'test@example.com', password: 'StrongPass1!' })
    ).rejects.toThrow('Registration failed')
  })

  it('propagates fetch network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(
      apiSignUp({ username: 'testuser', email: 'test@example.com', password: 'StrongPass1!' })
    ).rejects.toThrow('Network error')
  })

  it('sends correct Content-Type header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as Response)

    await apiSignUp({ username: 'testuser', email: 'test@example.com', password: 'StrongPass1!' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })
})

describe('apiLogin', () => {
  it('posts login data and returns user on success', async () => {
    const mockLoginResult = { username: 'testuser', email: 'test@example.com' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLoginResult,
    } as Response)

    const result = await apiLogin({ username: 'testuser', password: 'StrongPass1!' })

    expect(result).toEqual(mockLoginResult)
    expect(fetch).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ username: 'testuser', password: 'StrongPass1!' }) })
    )
  })

  it('throws error on invalid credentials', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response)

    await expect(
      apiLogin({ username: 'testuser', password: 'wrongpassword' })
    ).rejects.toThrow('Invalid credentials')
  })
})


describe('apiLogout', () => {
  it('sends a POST request to /api/logout', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)

    await apiLogout()

    expect(fetch).toHaveBeenCalledWith(
      '/api/logout',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' })
    )
  })
})
