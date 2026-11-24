import { describe, it, expect, vi, beforeEach } from 'vitest'

// React's cache() memoizes per server request. Simulate that: one store per "request", which
// the test clears to start a new request.
let requestStore = new Map<unknown, unknown>()
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) =>
      ((...args: never[]) => {
        if (!requestStore.has(fn)) requestStore.set(fn, fn(...args))
        return requestStore.get(fn)
      }) as T,
  }
})

const mockAuth = vi.fn()
const mockHasAccess = vi.fn()
vi.mock('@/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/access', () => ({ hasAccess: (id: number) => mockHasAccess(id) }))

import { getSessionUser } from './auth'

beforeEach(() => {
  requestStore = new Map()
  mockAuth.mockReset()
  mockHasAccess.mockReset()
  mockAuth.mockResolvedValue({ user: { id: '7', name: 'sam', image: null } })
  mockHasAccess.mockResolvedValue(true)
})

describe('getSessionUser per-request sharing', () => {
  it('runs the access query once when the layout and the page both call it in one request', async () => {
    await getSessionUser()
    await getSessionUser()
    expect(mockHasAccess).toHaveBeenCalledTimes(1)
  })

  it('does not share across requests, so a revoked Invite applies on the next request', async () => {
    mockHasAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await getSessionUser()).not.toBeNull()
    requestStore = new Map() // next request
    expect(await getSessionUser()).toBeNull()
    expect(mockHasAccess).toHaveBeenCalledTimes(2)
  })
})
