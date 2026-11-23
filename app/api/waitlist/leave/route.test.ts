import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLeave = vi.fn()
vi.mock('@/lib/waitlist', () => ({ leaveWaitlist: (...a: unknown[]) => mockLeave(...a) }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/waitlist/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => mockLeave.mockReset())

describe('POST /api/waitlist/leave', () => {
  it('removes the entry for a valid token', async () => {
    mockLeave.mockResolvedValue('removed')
    const res = await POST(req({ token: 'good' }))
    expect(mockLeave).toHaveBeenCalledWith('good')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('answers 400 "This link is invalid" for a tampered token', async () => {
    mockLeave.mockResolvedValue('invalid')
    const res = await POST(req({ token: 'bad' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This link is invalid' })
  })

  it.each([[{}], [{ token: 42 }], [{ token: '' }]])('answers 400 without deleting for body %j', async (body) => {
    const res = await POST(req(body))
    expect(res.status).toBe(400)
    expect(mockLeave).not.toHaveBeenCalled()
  })

  it('answers 400 for a malformed JSON body', async () => {
    const res = await POST(req('{nope'))
    expect(res.status).toBe(400)
    expect(mockLeave).not.toHaveBeenCalled()
  })
})
