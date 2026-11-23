import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJoin = vi.fn()
const mockNotify = vi.fn()
const afterCallbacks: Array<() => unknown> = []

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => unknown) => { afterCallbacks.push(fn) },
}))

vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: (fn: () => unknown) => fn() } }))
vi.mock('@/lib/waitlist', async () => {
  const actual = await vi.importActual<typeof import('@/lib/waitlist')>('@/lib/waitlist')
  return { ...actual, joinWaitlist: (...args: unknown[]) => mockJoin(...args) }
})
vi.mock('@/lib/email', () => ({
  sendWaitlistNotificationEmail: (...args: unknown[]) => mockNotify(...args),
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function flushAfter() {
  const pending = afterCallbacks.splice(0)
  for (const fn of pending) await fn()
}

beforeEach(() => {
  afterCallbacks.length = 0
  mockJoin.mockReset()
  mockNotify.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/waitlist', () => {
  it('creates an entry and sends exactly one admin notification', async () => {
    mockJoin.mockResolvedValue({ created: true })
    const res = await POST(req({ email: 'sam@example.com', name: 'Sam', marketingEmailOptIn: false }))
    expect(res.status).toBe(200)
    expect(mockJoin).toHaveBeenCalledWith({ email: 'sam@example.com', name: 'Sam', marketingEmailOptIn: false })
    await flushAfter()
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })

  it('defers the notification with after() so the response does not wait on it', async () => {
    mockJoin.mockResolvedValue({ created: true })
    await POST(req({ email: 'sam@example.com' }))
    expect(mockNotify).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
    await flushAfter()
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })

  it('sends no notification for a duplicate', async () => {
    mockJoin.mockResolvedValue({ created: false })
    await POST(req({ email: 'SAM@Example.com', name: 'Sam', marketingEmailOptIn: true }))
    await flushAfter()
    expect(afterCallbacks).toHaveLength(0)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('answers a new entry and a duplicate with the identical status and body', async () => {
    mockJoin.mockResolvedValueOnce({ created: true })
    const first = await POST(req({ email: 'sam@example.com', name: 'Sam' }))
    mockJoin.mockResolvedValueOnce({ created: false })
    const second = await POST(req({ email: 'SAM@Example.com', marketingEmailOptIn: true }))
    expect(second.status).toBe(first.status)
    expect(await second.text()).toBe(await first.text())
  })

  it('still answers success when the admin notification fails', async () => {
    mockJoin.mockResolvedValue({ created: true })
    mockNotify.mockRejectedValue(new Error('resend down'))
    const res = await POST(req({ email: 'sam@example.com' }))
    expect(res.status).toBe(200)
    await expect(flushAfter()).resolves.toBeUndefined()
  })

  it.each([
    [{ email: 'sam@' }],
    [{ email: '' }],
    [{}],
    [{ email: 42 }],
  ])('rejects invalid email %j with "Enter a valid email" and creates nothing', async (body) => {
    const res = await POST(req(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Enter a valid email' })
    expect(mockJoin).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body without creating anything', async () => {
    const res = await POST(req('{not json'))
    expect(res.status).toBe(400)
    expect(mockJoin).not.toHaveBeenCalled()
  })

  it('treats a non-boolean opt-in as false', async () => {
    mockJoin.mockResolvedValue({ created: true })
    await POST(req({ email: 'sam@example.com', marketingEmailOptIn: 'yes' }))
    expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ marketingEmailOptIn: false }))
  })
})
