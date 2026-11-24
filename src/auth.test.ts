// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogin = vi.fn()
const mockTrack = vi.fn()
const mockHasAccess = vi.fn()
type Config = { providers: Array<{ authorize?: (c: unknown, r: unknown) => Promise<unknown> }> }
const held = vi.hoisted(() => ({ config: undefined as unknown }))

vi.mock('next-auth', () => ({
  default: (config: unknown) => {
    held.config = config
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }
  },
  CredentialsSignin: class extends Error {},
}))
vi.mock('next-auth/providers/google', () => ({ default: () => ({}) }))
vi.mock('next-auth/providers/apple', () => ({ default: () => ({}) }))
vi.mock('next-auth/providers/credentials', () => ({
  default: (opts: unknown) => opts,
}))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/users', () => ({
  login: (...a: unknown[]) => mockLogin(...a),
  trackLoginAttempt: (...a: unknown[]) => mockTrack(...a),
  reactivateAccount: vi.fn(),
}))
vi.mock('@/lib/oauth', () => ({ findOrCreateOAuthUser: vi.fn() }))
vi.mock('@/lib/access', () => ({ hasAccess: (id: number) => mockHasAccess(id) }))

import './auth'

const request = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }) }
const creds = { username: 'sam', password: 'pw' }

function authorize() {
  const provider = (held.config as Config).providers.find((p) => p.authorize)!
  return provider.authorize!(creds, request)
}

beforeEach(() => {
  mockLogin.mockReset()
  mockTrack.mockReset()
  mockHasAccess.mockReset()
  mockLogin.mockResolvedValue({ id: 7, username: 'sam', email: 'sam@example.com' })
})

describe('credentials authorize and the invite-only lock (#379)', () => {
  it('returns the user when they have access', async () => {
    mockHasAccess.mockResolvedValue(true)
    expect(await authorize()).toMatchObject({ id: '7', name: 'sam' })
    expect(mockHasAccess).toHaveBeenCalledWith(7)
  })

  it('rejects a Waitlisted User with the right password using the WAITLISTED code (no session)', async () => {
    mockHasAccess.mockResolvedValue(false)
    await expect(authorize()).rejects.toMatchObject({ code: 'WAITLISTED' })
  })

  it('does not check access when the password is wrong (same null result as any bad login)', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid username or password'))
    expect(await authorize()).toBeNull()
    expect(mockHasAccess).not.toHaveBeenCalled()
  })

  it('does not record a successful login for a Waitlisted User', async () => {
    mockHasAccess.mockResolvedValue(false)
    await authorize().catch(() => {})
    expect(mockTrack).not.toHaveBeenCalled()
  })
})
