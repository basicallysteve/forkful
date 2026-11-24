// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetToken = vi.fn()
const mockHasAccess = vi.fn()
vi.mock('next-auth/jwt', () => ({ getToken: (...a: unknown[]) => mockGetToken(...a) }))
vi.mock('@/lib/access', () => ({ hasAccess: (id: number) => mockHasAccess(id) }))

import { proxy } from './proxy'

function req(path: string, signedIn = true) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: signedIn ? { cookie: 'authjs.session-token=abc' } : {},
  })
}

beforeEach(() => {
  mockGetToken.mockReset()
  mockHasAccess.mockReset()
  mockGetToken.mockResolvedValue({ userId: 7 })
})

describe('proxy access lock (ADR-0032)', () => {
  it('redirects a signed-in user without an Invite from /pantry to /waitlist', async () => {
    mockHasAccess.mockResolvedValue(false)
    const res = await proxy(req('/pantry'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/waitlist')
    expect(mockHasAccess).toHaveBeenCalledWith(7)
  })

  it('lets an allowed user through', async () => {
    mockHasAccess.mockResolvedValue(true)
    const res = await proxy(req('/pantry'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('locks other account pages too', async () => {
    mockHasAccess.mockResolvedValue(false)
    for (const p of ['/profile', '/log', '/shopping-list', '/recipes/new']) {
      const res = await proxy(req(p))
      expect(new URL(res.headers.get('location')!).pathname, p).toBe('/waitlist')
    }
  })

  it('leaves public routes alone even for a signed-in user without an Invite', async () => {
    mockHasAccess.mockResolvedValue(false)
    for (const p of ['/recipes', '/blog', '/blog/some-post', '/about', '/waitlist', '/waitlist/leave', '/login']) {
      const res = await proxy(req(p))
      expect(res.headers.get('location'), p).toBeNull()
    }
    expect(mockHasAccess).not.toHaveBeenCalled()
  })

  it('still sends signed-out visitors on protected routes to /login without a DB check', async () => {
    const res = await proxy(req('/pantry', false))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    expect(mockHasAccess).not.toHaveBeenCalled()
  })
})
