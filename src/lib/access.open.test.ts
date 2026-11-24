import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInviteOnly = vi.fn()
vi.mock('@/lib/inviteOnly', () => ({ isInviteOnly: (...a: unknown[]) => mockInviteOnly(...a) }))
const limit = vi.fn()
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit }), innerJoin: () => ({ where: () => ({ limit }) }) }),
    }),
  },
}))

import { hasAccess, emailHasInvite } from './access'

beforeEach(() => {
  limit.mockReset().mockResolvedValue([])
  mockInviteOnly.mockReset()
  process.env.ADMIN_USER_ID = '1'
})

describe('access with the invite-only flag off (open sign-up, #374)', () => {
  beforeEach(() => { mockInviteOnly.mockResolvedValue(false) })

  it('hasAccess allows anyone, without an Invite and without querying', async () => {
    expect(await hasAccess(7)).toBe(true)
    expect(limit).not.toHaveBeenCalled()
  })

  it('emailHasInvite is true for an uninvited email, so OAuth creates the account', async () => {
    expect(await emailHasInvite('new@example.com')).toBe(true)
    expect(limit).not.toHaveBeenCalled()
  })
})

describe('access with the invite-only flag on (waitlist mode, unchanged)', () => {
  beforeEach(() => { mockInviteOnly.mockResolvedValue(true) })

  it('hasAccess denies a user with no Invite', async () => {
    expect(await hasAccess(7)).toBe(false)
  })

  it('emailHasInvite is false for an uninvited email', async () => {
    expect(await emailHasInvite('new@example.com')).toBe(false)
  })

  it('hands the request to the flag reader (proxy has no next/headers)', async () => {
    const request = { headers: new Headers() }
    await hasAccess(7, request)
    expect(mockInviteOnly).toHaveBeenCalledWith(request)
  })
})
