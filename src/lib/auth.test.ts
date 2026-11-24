import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.fn()
const mockHasAccess = vi.fn()
vi.mock('@/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/access', () => ({ hasAccess: (id: number) => mockHasAccess(id) }))

import { getSessionUser } from './auth'

const session = { user: { id: '7', name: 'sam', image: null } }

beforeEach(() => {
  mockAuth.mockReset()
  mockHasAccess.mockReset()
})

describe('getSessionUser access lock', () => {
  it('returns null with no session, without checking access', async () => {
    mockAuth.mockResolvedValue(null)
    expect(await getSessionUser()).toBeNull()
    expect(mockHasAccess).not.toHaveBeenCalled()
  })

  it('returns the user when access is allowed', async () => {
    mockAuth.mockResolvedValue(session)
    mockHasAccess.mockResolvedValue(true)
    expect(await getSessionUser()).toMatchObject({ userId: 7, username: 'sam' })
    expect(mockHasAccess).toHaveBeenCalledWith(7)
  })

  it('returns null for a signed-in user without an Invite (APIs then answer 401)', async () => {
    mockAuth.mockResolvedValue(session)
    mockHasAccess.mockResolvedValue(false)
    expect(await getSessionUser()).toBeNull()
  })

  it('re-checks on every call so a revoked Invite takes effect without re-login', async () => {
    mockAuth.mockResolvedValue(session)
    mockHasAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await getSessionUser()).not.toBeNull()
    expect(await getSessionUser()).toBeNull()
  })
})
