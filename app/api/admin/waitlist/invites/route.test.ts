import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSessionUser: () => mockSession(),
  isAdmin: (id: number) => id === 1,
}))
vi.mock('@/lib/invites', () => ({ createInvite: (...args: unknown[]) => mockCreate(...args) }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/admin/waitlist/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  mockSession.mockReset().mockResolvedValue({ userId: 1 })
  mockCreate.mockReset()
})

describe('POST /api/admin/waitlist/invites', () => {
  it('returns 401 without a session', async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST(req({ email: 'a@example.com' }))
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-admin', async () => {
    mockSession.mockResolvedValue({ userId: 2 })
    const res = await POST(req({ email: 'a@example.com' }))
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejects an invalid typed email with 400 and creates nothing', async () => {
    const res = await POST(req({ email: 'pat@' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejects a body with neither entryId nor email', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect((await POST(req('not json'))).status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('invites a typed email and returns the raw code once, uncached', async () => {
    mockCreate.mockResolvedValue({ status: 'created', inviteId: 9, email: 'pat@example.com', code: 'RAWCODE' })
    const res = await POST(req({ email: ' Pat@Example.com ' }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({ email: 'Pat@Example.com' })
    expect(await res.json()).toEqual({ inviteId: 9, email: 'pat@example.com', code: 'RAWCODE' })
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('invites by entry id', async () => {
    mockCreate.mockResolvedValue({ status: 'created', inviteId: 9, email: 'pat@example.com', code: 'RAWCODE' })
    const res = await POST(req({ entryId: 4 }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({ entryId: 4 })
  })

  it('answers "Already invited" with 409 and no code', async () => {
    mockCreate.mockResolvedValue({ status: 'already-invited' })
    const res = await POST(req({ email: 'pat@example.com' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Already invited')
    expect(body.code).toBeUndefined()
  })

  it('returns 404 when the entry does not exist', async () => {
    mockCreate.mockResolvedValue({ status: 'entry-not-found' })
    const res = await POST(req({ entryId: 999 }))
    expect(res.status).toBe(404)
  })
})
