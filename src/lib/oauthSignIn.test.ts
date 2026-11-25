import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockFindExisting = vi.fn()
const mockFindOrCreate = vi.fn()
const mockHasAccess = vi.fn()
const mockEmailHasInvite = vi.fn()
const mockJoinWaitlist = vi.fn()
const mockSendNotification = vi.fn()
const mockReactivate = vi.fn()
const mockCaptureError = vi.fn()
const mockGetInvite = vi.fn()
const mockRecord = vi.fn()
const afterCallbacks: Array<() => unknown> = []
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { afterCallbacks.push(fn) } }))
vi.mock('@/lib/invites', () => ({ getInviteByEmail: (e: string) => mockGetInvite(e) }))
vi.mock('@/lib/adminSignals', () => ({ recordAdminEvent: (...a: unknown[]) => mockRecord(...a) }))

vi.mock('@/lib/oauth', () => ({
  findExistingOAuthUser: (p: unknown) => mockFindExisting(p),
  findOrCreateOAuthUser: (p: unknown) => mockFindOrCreate(p),
}))
vi.mock('@/lib/access', () => ({
  hasAccess: (id: number) => mockHasAccess(id),
  emailHasInvite: (e: string) => mockEmailHasInvite(e),
}))
vi.mock('@/lib/waitlist', () => ({
  joinWaitlist: (i: unknown) => mockJoinWaitlist(i),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}))
vi.mock('@/lib/email', () => ({ sendWaitlistNotificationEmail: (e: unknown) => mockSendNotification(e) }))
vi.mock('@/lib/users', () => ({ reactivateAccount: (id: number) => mockReactivate(id) }))
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  captureError: (e: unknown, o: unknown) => mockCaptureError(e, o),
}))

import { resolveOAuthSignIn } from './oauthSignIn'

const google = { provider: 'google', providerAccountId: 'g-1', email: 'Jane@Example.com', name: 'Jane', avatarUrl: null }

beforeEach(() => {
  vi.resetAllMocks()
  afterCallbacks.length = 0
  mockRecord.mockResolvedValue(undefined)
  mockSendNotification.mockResolvedValue(undefined)
  mockReactivate.mockResolvedValue(undefined)
})

describe('resolveOAuthSignIn: uninvited, unknown email', () => {
  beforeEach(() => {
    mockFindExisting.mockResolvedValue(null)
    mockEmailHasInvite.mockResolvedValue(false)
    mockJoinWaitlist.mockResolvedValue({ created: true })
  })

  it('creates no user or oauth_account, joins the Waitlist and redirects to /waitlist', async () => {
    expect(await resolveOAuthSignIn(google)).toBe('/waitlist')
    expect(mockFindOrCreate).not.toHaveBeenCalled()
    expect(mockJoinWaitlist).toHaveBeenCalledWith({ email: 'Jane@Example.com', name: 'Jane', marketingEmailOptIn: false })
  })

  it('sends the normal admin notification for a newly created entry', async () => {
    await resolveOAuthSignIn(google)
    expect(mockSendNotification).toHaveBeenCalledWith({ email: 'jane@example.com', name: 'Jane', marketingEmailOptIn: false })
  })

  it('is idempotent: a duplicate entry still redirects but sends no second notification', async () => {
    mockJoinWaitlist.mockResolvedValue({ created: false })
    expect(await resolveOAuthSignIn(google)).toBe('/waitlist')
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('still redirects when the notification email fails', async () => {
    mockSendNotification.mockRejectedValue(new Error('boom'))
    expect(await resolveOAuthSignIn(google)).toBe('/waitlist')
    expect(mockCaptureError).toHaveBeenCalled()
  })

  it('denies sign-in when the Waitlist write fails', async () => {
    mockJoinWaitlist.mockRejectedValue(new Error('db down'))
    expect(await resolveOAuthSignIn(google)).toBe(false)
    expect(mockCaptureError).toHaveBeenCalled()
  })

  it('denies sign-in with no email and no existing link (Apple returning user without a row)', async () => {
    expect(await resolveOAuthSignIn({ ...google, email: null })).toBe(false)
    expect(mockJoinWaitlist).not.toHaveBeenCalled()
  })
})

describe('resolveOAuthSignIn: invited, unknown email', () => {
  it('creates the account and signs in with no code', async () => {
    mockFindExisting.mockResolvedValue(null)
    mockEmailHasInvite.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(9)
    expect(await resolveOAuthSignIn(google)).toBe(true)
    expect(mockFindOrCreate).toHaveBeenCalledWith(google)
    expect(mockJoinWaitlist).not.toHaveBeenCalled()
  })
})

describe('resolveOAuthSignIn: existing account', () => {
  it('known Waitlisted User (no Invite): no session, no writes, redirect to /waitlist', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(false)
    expect(await resolveOAuthSignIn(google)).toBe('/waitlist')
    expect(mockHasAccess).toHaveBeenCalledWith(4)
    expect(mockFindOrCreate).not.toHaveBeenCalled()
    expect(mockJoinWaitlist).not.toHaveBeenCalled()
  })

  it('invited existing user signs in, linking by their stored email', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(4)
    expect(await resolveOAuthSignIn(google)).toBe(true)
    expect(mockFindOrCreate).toHaveBeenCalledWith({ ...google, email: 'jane@example.com' })
  })

  it('reactivates a deactivated account that has access', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: new Date() })
    mockHasAccess.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(4)
    await resolveOAuthSignIn(google)
    expect(mockReactivate).toHaveBeenCalledWith(4)
  })

  it('does not reactivate a deactivated account without access', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: new Date() })
    mockHasAccess.mockResolvedValue(false)
    expect(await resolveOAuthSignIn(google)).toBe('/waitlist')
    expect(mockReactivate).not.toHaveBeenCalled()
  })

  it('returning Apple user without email: allowed when linked and invited', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(true)
    expect(await resolveOAuthSignIn({ ...google, provider: 'apple', email: null })).toBe(true)
    expect(mockFindOrCreate).not.toHaveBeenCalled()
  })

  it('returning Apple user without email: waitlist message when linked but not invited', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(false)
    expect(await resolveOAuthSignIn({ ...google, provider: 'apple', email: null })).toBe('/waitlist')
  })

  it('denies sign-in when the account lookup throws', async () => {
    mockFindExisting.mockRejectedValue(new Error('db down'))
    expect(await resolveOAuthSignIn(google)).toBe(false)
    expect(mockCaptureError).toHaveBeenCalled()
  })
})

describe('resolveOAuthSignIn: provider email verification', () => {
  beforeEach(() => {
    mockFindExisting.mockResolvedValue(null)
    mockEmailHasInvite.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(9)
    mockJoinWaitlist.mockResolvedValue({ created: true })
  })

  it('denies an unverified Google email: no lookup, account, link or waitlist entry', async () => {
    expect(await resolveOAuthSignIn({ ...google, emailVerified: false })).toBe(false)
    expect(mockEmailHasInvite).not.toHaveBeenCalled()
    expect(mockFindOrCreate).not.toHaveBeenCalled()
    expect(mockJoinWaitlist).not.toHaveBeenCalled()
  })

  it('denies an unverified email even when it would match an existing account', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(true)
    expect(await resolveOAuthSignIn({ ...google, emailVerified: false })).toBe(false)
    expect(mockFindOrCreate).not.toHaveBeenCalled()
  })

  it('denies Apple\'s string "false"', async () => {
    expect(await resolveOAuthSignIn({ ...google, provider: 'apple', emailVerified: 'false' })).toBe(false)
    expect(mockFindOrCreate).not.toHaveBeenCalled()
  })

  it.each([true, 'true', undefined, null])('treats emailVerified=%s as verified', async (emailVerified) => {
    expect(await resolveOAuthSignIn({ ...google, emailVerified })).toBe(true)
  })
})

describe('resolveOAuthSignIn: invite-accepted admin signal', () => {
  async function flush() {
    for (const fn of afterCallbacks.splice(0)) await fn()
  }

  beforeEach(() => {
    mockFindExisting.mockResolvedValue(null)
    mockEmailHasInvite.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(9)
    mockGetInvite.mockResolvedValue({ id: 1, codeHash: 'h', codeUsedAt: null })
  })

  it('records invite-accepted for the account just created from an Invite, deferred with after()', async () => {
    expect(await resolveOAuthSignIn(google)).toBe(true)
    expect(mockRecord).not.toHaveBeenCalled()
    await flush()
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith('invite-accepted', 9)
  })

  it('records nothing when the email has no Invite (open sign-up)', async () => {
    mockGetInvite.mockResolvedValue(null)
    await resolveOAuthSignIn(google)
    await flush()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('records nothing when the account already existed (a later sign-in)', async () => {
    mockFindExisting.mockResolvedValue({ userId: 4, email: 'jane@example.com', dateDeleted: null })
    mockHasAccess.mockResolvedValue(true)
    mockFindOrCreate.mockResolvedValue(4)
    await resolveOAuthSignIn(google)
    await flush()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('still signs in when recording or the invite lookup fails', async () => {
    mockRecord.mockRejectedValue(new Error('db down'))
    expect(await resolveOAuthSignIn(google)).toBe(true)
    await expect(flush()).resolves.toBeUndefined()
    mockGetInvite.mockRejectedValue(new Error('db down'))
    expect(await resolveOAuthSignIn(google)).toBe(true)
    await expect(flush()).resolves.toBeUndefined()
  })
})
