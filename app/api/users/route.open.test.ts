import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignUp = vi.fn()
const mockAccountEmail = vi.fn()
const mockJoin = vi.fn()
const mockGetInvite = vi.fn()
const mockSignUpWithInvite = vi.fn()

vi.mock('@/lib/inviteOnly', () => ({ isInviteOnly: () => Promise.resolve(false) }))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: (fn: () => unknown) => fn() } }))
vi.mock('@/lib/users', () => ({ signUp: (...a: unknown[]) => mockSignUp(...a) }))
vi.mock('@/lib/waitlist', async () => {
  const actual = await vi.importActual<typeof import('@/lib/waitlist')>('@/lib/waitlist')
  return { ...actual, joinWaitlist: (...a: unknown[]) => mockJoin(...a) }
})
vi.mock('@/lib/invites', () => ({
  getInviteByEmail: (...a: unknown[]) => mockGetInvite(...a),
  signUpWithInvite: (...a: unknown[]) => mockSignUpWithInvite(...a),
}))
vi.mock('@/lib/email', () => ({
  sendWaitlistNotificationEmail: vi.fn(),
  sendUserAccountCreationEmail: (...a: unknown[]) => mockAccountEmail(...a),
}))

import { POST } from './route'

const valid = { username: 'newcook', email: 'Sam@Example.com', password: 'StrongPass1!', cuisinePreferences: [], dietaryRestrictions: [] }

function req(body: unknown) {
  return new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockSignUp.mockReset().mockResolvedValue({ id: '7', username: 'newcook', email: 'sam@example.com' })
  mockAccountEmail.mockReset().mockResolvedValue(undefined)
  mockJoin.mockReset()
  mockGetInvite.mockReset().mockResolvedValue(null)
  mockSignUpWithInvite.mockReset()
})

describe('POST /api/users with the invite-only flag off (open sign-up, #374)', () => {
  it('creates the account for an uninvited email with no code, and does not waitlist it', async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: '7', username: 'newcook', email: 'sam@example.com' })
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ username: 'newcook', email: 'sam@example.com' }))
    expect(mockJoin).not.toHaveBeenCalled()
    expect(mockSignUpWithInvite).not.toHaveBeenCalled()
  })

  it('sends the "New user signed up" admin email again, as before the waitlist', async () => {
    await POST(req(valid))
    expect(mockAccountEmail).toHaveBeenCalledWith('newcook')
  })

  it('still validates username, email and password', async () => {
    expect((await POST(req({ ...valid, username: 'x' }))).status).toBe(400)
    expect((await POST(req({ ...valid, email: 'nope' }))).status).toBe(400)
    expect((await POST(req({ ...valid, password: 'short' }))).status).toBe(400)
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns the error when sign-up fails (for example a taken username)', async () => {
    mockSignUp.mockRejectedValue(new Error('Username already in use'))
    const res = await POST(req(valid))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Username already in use' })
    expect(mockAccountEmail).not.toHaveBeenCalled()
  })
})
