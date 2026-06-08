import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST, DELETE } from './route'
import { getSessionUser } from '@/lib/auth'
import { getUser, updateUserAvatar, deleteUserAvatar } from '@/lib/users'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/users', () => ({
  getUser: vi.fn(),
  updateUserAvatar: vi.fn(),
  deleteUserAvatar: vi.fn(),
}))
vi.mock('@/lib/TaskRunner', () => ({
  taskRunner: { run: vi.fn((fn: () => unknown) => fn()) },
}))
vi.mock('@/lib/session', () => ({
  encrypt: vi.fn().mockResolvedValue('mock-token'),
  SESSION_DURATION_MS: 3600000,
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}))
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.app/avatars/1-123.png' }),
}))

function makeFormRequest(id: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const request = Object.assign(
    new Request(`http://localhost/api/users/${id}/avatar`, { method: 'POST' }),
    { formData: async () => formData }
  )
  return { request, params: Promise.resolve({ id }) }
}

function makeDeleteRequest(id: string) {
  return {
    request: new Request(`http://localhost/api/users/${id}/avatar`, { method: 'DELETE' }),
    params: Promise.resolve({ id }),
  }
}

function makePngFile(size = 100) {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([bytes], 'avatar.png', { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as Mock).mockResolvedValue({ avatarUrl: null })
})

describe('POST /api/users/[id]/avatar — auth', () => {
  it('returns 401 when not logged in', async () => {
    ;(getSessionUser as Mock).mockResolvedValue(null)
    const { request, params } = makeFormRequest('1', makePngFile())
    const res = await POST(request, { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when session user does not match id', async () => {
    ;(getSessionUser as Mock).mockResolvedValue({ userId: 2, username: 'bob' })
    const { request, params } = makeFormRequest('1', makePngFile())
    const res = await POST(request, { params })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/users/[id]/avatar — validation', () => {
  beforeEach(() => {
    ;(getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
  })

  it('returns 400 when no file provided', async () => {
    const formData = new FormData()
    const request = new Request('http://localhost/api/users/1/avatar', { method: 'POST', body: formData })
    const res = await POST(request, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('No file provided')
  })

  it('returns 400 for disallowed file type', async () => {
    const file = new File([new Uint8Array(10)], 'avatar.gif', { type: 'image/gif' })
    const { request, params } = makeFormRequest('1', file)
    const res = await POST(request, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('File must be JPEG, PNG, or WebP')
  })

  it('returns 400 for file over 2MB', async () => {
    const file = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    const { request, params } = makeFormRequest('1', file)
    const res = await POST(request, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('File must be under 2MB')
  })
})

describe('POST /api/users/[id]/avatar — success', () => {
  beforeEach(() => {
    ;(getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
  })

  it('returns the blob url on success', async () => {
    const { request, params } = makeFormRequest('1', makePngFile())
    const res = await POST(request, { params })
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.vercel.app/avatars/1-123.png')
  })

  it('calls updateUserAvatar with old url', async () => {
    ;(getUser as Mock).mockResolvedValue({ avatarUrl: 'https://old.url/a.png' })
    const { request, params } = makeFormRequest('1', makePngFile())
    await POST(request, { params })
    expect(updateUserAvatar).toHaveBeenCalledWith(1, 'https://blob.vercel.app/avatars/1-123.png', 'https://old.url/a.png')
  })
})

describe('DELETE /api/users/[id]/avatar — auth', () => {
  it('returns 401 when not logged in', async () => {
    ;(getSessionUser as Mock).mockResolvedValue(null)
    const { request, params } = makeDeleteRequest('1')
    const res = await DELETE(request, { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when session user does not match id', async () => {
    ;(getSessionUser as Mock).mockResolvedValue({ userId: 2, username: 'bob' })
    const { request, params } = makeDeleteRequest('1')
    const res = await DELETE(request, { params })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/users/[id]/avatar — success', () => {
  beforeEach(() => {
    ;(getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
  })

  it('returns ok on success', async () => {
    const { request, params } = makeDeleteRequest('1')
    const res = await DELETE(request, { params })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('calls deleteUserAvatar with the existing avatar url', async () => {
    ;(getUser as Mock).mockResolvedValue({ avatarUrl: 'https://old.url/a.png' })
    const { request, params } = makeDeleteRequest('1')
    await DELETE(request, { params })
    expect(deleteUserAvatar).toHaveBeenCalledWith(1, 'https://old.url/a.png')
  })
})
