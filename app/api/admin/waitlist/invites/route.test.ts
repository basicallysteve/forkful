import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
const mockCreate = vi.fn()
const mockSendInvite = vi.fn()
const mockCapture = vi.fn()

vi.mock('@/lib/auth', () => ({
  getSessionUser: () => mockSession(),
  isAdmin: (id: number) => id === 1,
}))
vi.mock('@/lib/invites', () => ({ createInvite: (...args: unknown[]) => mockCreate(...args) }))

vi.mock('@/lib/email', () => ({ sendInviteEmail: (...args: unknown[]) => mockSendInvite(...args) }))
vi.mock('@/lib/logger', () => ({ captureError: (...args: unknown[]) => mockCapture(...args) }))

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
  mockSendInvite.mockReset().mockResolvedValue(undefined)
  mockCapture.mockReset()
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
    expect(await res.json()).toEqual({ inviteId: 9, email: 'pat@example.com', code: 'RAWCODE', emailSent: true })
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

  it('rejects an entryId outside the int4 range with 400 before reaching the database', async () => {
    for (const entryId of [0, -1, 2147483648, 1.5]) {
      expect((await POST(req({ entryId }))).status).toBe(400)
    }
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('accepts the largest int4 entryId', async () => {
    mockCreate.mockResolvedValue({ status: 'entry-not-found' })
    expect((await POST(req({ entryId: 2147483647 }))).status).toBe(404)
  })

  it('returns 404 when the entry does not exist', async () => {
    mockCreate.mockResolvedValue({ status: 'entry-not-found' })
    const res = await POST(req({ entryId: 999 }))
    expect(res.status).toBe(404)
  })

  describe('Invite Email', () => {
    const created = { status: 'created', inviteId: 9, email: 'pat@example.com', code: 'RAWCODE' }

    it('sends exactly one Invite Email to the invited address with the raw code', async () => {
      mockCreate.mockResolvedValue(created)
      await POST(req({ email: 'pat@example.com' }))
      expect(mockSendInvite).toHaveBeenCalledTimes(1)
      expect(mockSendInvite).toHaveBeenCalledWith({ to: 'pat@example.com', code: 'RAWCODE' })
    })

    it('sends nothing for an "Already invited" attempt or a missing entry', async () => {
      mockCreate.mockResolvedValue({ status: 'already-invited' })
      await POST(req({ email: 'pat@example.com' }))
      mockCreate.mockResolvedValue({ status: 'entry-not-found' })
      await POST(req({ entryId: 4 }))
      expect(mockSendInvite).not.toHaveBeenCalled()
    })

    it('keeps the Invite and reports emailSent false when the send fails', async () => {
      mockCreate.mockResolvedValue(created)
      mockSendInvite.mockRejectedValue(new Error('resend down'))
      const res = await POST(req({ email: 'pat@example.com' }))
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ inviteId: 9, code: 'RAWCODE', emailSent: false })
      expect(res.headers.get('Cache-Control')).toContain('no-store')
    })

    it('logs a failed send with the area only, never the address or the code', async () => {
      mockCreate.mockResolvedValue(created)
      mockSendInvite.mockRejectedValue(new Error('resend down'))
      await POST(req({ email: 'pat@example.com' }))
      expect(mockCapture).toHaveBeenCalledTimes(1)
      const [, options] = mockCapture.mock.calls[0]
      expect(options).toEqual({ area: 'waitlist' })
    })
  })
})
