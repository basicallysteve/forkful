import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiListWaitlist, apiInvite, apiRevokeInvite, apiDeleteWaitlistEntry, apiSendWaitlistNotice } from './waitlistAdmin'
import { ForbiddenError, UnauthorizedError } from './errors'

const fetchMock = vi.fn()

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('waitlist admin client', () => {
  it('sends the waitlist notice with a POST and returns the counts', async () => {
    fetchMock.mockResolvedValue(json(200, { sent: 3, failed: 0 }))
    expect(await apiSendWaitlistNotice()).toEqual({ sent: 3, failed: 0 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/waitlist/notice')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('throws the server message when the notice fails, and the shared error on 403', async () => {
    fetchMock.mockResolvedValueOnce(json(500, { error: 'Nope' }))
    await expect(apiSendWaitlistNotice()).rejects.toThrow('Nope')
    fetchMock.mockResolvedValueOnce(json(403, {}))
    await expect(apiSendWaitlistNotice()).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lists entries', async () => {
    fetchMock.mockResolvedValue(json(200, [{ id: 1, email: 'a@example.com' }]))
    expect(await apiListWaitlist()).toEqual([{ id: 1, email: 'a@example.com' }])
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/waitlist')
  })

  it('maps 401 and 403 to the shared errors', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Unauthorized' }))
    await expect(apiListWaitlist()).rejects.toBeInstanceOf(UnauthorizedError)
    fetchMock.mockResolvedValueOnce(json(403, { error: 'Forbidden' }))
    await expect(apiListWaitlist()).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('invites by entry id or email and returns the code', async () => {
    fetchMock.mockResolvedValue(json(201, { inviteId: 2, email: 'a@example.com', code: 'RAW' }))
    expect(await apiInvite({ entryId: 1 })).toEqual({ status: 'created', inviteId: 2, email: 'a@example.com', code: 'RAW' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ entryId: 1 })
    await apiInvite({ email: 'a@example.com' })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: 'a@example.com' })
  })

  it('reports Already invited without throwing', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'Already invited' }))
    expect(await apiInvite({ email: 'a@example.com' })).toEqual({ status: 'already-invited' })
  })

  it('throws the server message for a validation error', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'Enter a valid email' }))
    await expect(apiInvite({ email: 'pat@' })).rejects.toThrow('Enter a valid email')
  })

  it('revokes an invite and deletes an entry with DELETE', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    await apiRevokeInvite(7)
    await apiDeleteWaitlistEntry(8)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/waitlist/invites/7')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/waitlist/entries/8')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })
})
