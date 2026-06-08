import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiSignUp, apiLogin, apiLogout, apiUpdatePreferences, apiUpdateEmail, apiUpdatePassword, apiUploadAvatar, apiDeleteAvatar } from './users'

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

describe('apiUpdatePreferences', () => {
  it('sends PATCH with preferences action', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)

    await apiUpdatePreferences(42, ['Italian'], ['Vegan'])

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/42',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'preferences', cuisinePreferences: ['Italian'], dietaryRestrictions: ['Vegan'] }),
      })
    )
  })

  it('throws with server error message on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid preferences data' }),
    } as Response)

    await expect(apiUpdatePreferences(42, [], [])).rejects.toThrow('Invalid preferences data')
  })
})

describe('apiUpdateEmail', () => {
  it('sends PATCH with email action', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)

    await apiUpdateEmail(42, 'new@example.com')

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/42',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'email', email: 'new@example.com' }),
      })
    )
  })

  it('throws when email is already in use', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Email already in use' }),
    } as Response)

    await expect(apiUpdateEmail(42, 'taken@example.com')).rejects.toThrow('Email already in use')
  })
})

describe('apiUpdatePassword', () => {
  it('sends PATCH with password action', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)

    await apiUpdatePassword(42, 'OldPass1!', 'NewPass1!')

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/42',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'password', currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }),
      })
    )
  })

  it('throws when current password is incorrect', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Current password is incorrect' }),
    } as Response)

    await expect(apiUpdatePassword(42, 'wrong', 'NewPass1!')).rejects.toThrow('Current password is incorrect')
  })

  it('throws generic message when error body cannot be parsed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('invalid json') },
    } as unknown as Response)

    await expect(apiUpdatePassword(42, 'OldPass1!', 'NewPass1!')).rejects.toThrow('Update failed')
  })
})

describe('apiUploadAvatar', () => {
  it('posts form data and returns url', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://blob.vercel.app/a.png' }),
    } as Response)

    const file = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })
    const result = await apiUploadAvatar(1, file)

    expect(result.url).toBe('https://blob.vercel.app/a.png')
    expect(fetch).toHaveBeenCalledWith(
      '/api/users/1/avatar',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File must be JPEG, PNG, or WebP' }),
    } as Response)

    const file = new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' })
    await expect(apiUploadAvatar(1, file)).rejects.toThrow('File must be JPEG, PNG, or WebP')
  })
})

describe('apiDeleteAvatar', () => {
  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)

    await apiDeleteAvatar(1)

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/1/avatar',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response)

    await expect(apiDeleteAvatar(1)).rejects.toThrow('Unauthorized')
  })
})
