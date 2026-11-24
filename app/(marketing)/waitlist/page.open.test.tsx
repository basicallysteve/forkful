import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInviteOnly = vi.fn()
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('@/lib/inviteOnly', () => ({ isInviteOnly: () => mockInviteOnly() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: () => Promise.resolve(null) }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => mockRedirect(url) }))

import WaitlistPage from './page'

beforeEach(() => { mockRedirect.mockClear() })

describe('/waitlist with the invite-only flag (#374)', () => {
  it('redirects a visitor to /create-account while sign-up is open', async () => {
    mockInviteOnly.mockResolvedValue(false)
    await expect(WaitlistPage()).rejects.toThrow('NEXT_REDIRECT:/create-account')
  })

  it('shows the join form while invite-only is on', async () => {
    mockInviteOnly.mockResolvedValue(true)
    await expect(WaitlistPage()).resolves.toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
