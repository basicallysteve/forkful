import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJoin = vi.fn()
const mockNotify = vi.fn()
const mockAccountEmail = vi.fn()
const mockGetInvite = vi.fn()
const mockSignUpWithInvite = vi.fn()
const afterCallbacks: Array<() => unknown> = []
const mockRecord = vi.fn()
vi.mock('@/lib/adminSignals', () => ({ recordAdminEvent: (...a: unknown[]) => mockRecord(...a) }))

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
vi.mock('@/lib/invites', async () => {
  const actual = await vi.importActual<typeof import('@/lib/invites')>('@/lib/invites')
  return {
    ...actual,
    getInviteByEmail: (...args: unknown[]) => mockGetInvite(...args),
    signUpWithInvite: (...args: unknown[]) => mockSignUpWithInvite(...args),
  }
})
vi.mock('@/lib/email', () => ({
  sendWaitlistNotificationEmail: (...args: unknown[]) => mockNotify(...args),
  sendUserAccountCreationEmail: (...args: unknown[]) => mockAccountEmail(...args),
}))

import { POST as postUsers } from './route'
import { POST as postWaitlist } from '../waitlist/route'

const valid = {
  username: 'newcook',
  email: 'Sam@Example.com',
  password: 'StrongPass1!',
  cuisinePreferences: [],
  dietaryRestrictions: [],
  code: 'the-code',
}

function req(body: unknown, url = 'http://localhost/api/users') {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  afterCallbacks.length = 0
  mockRecord.mockReset().mockResolvedValue(undefined)
  mockJoin.mockReset().mockResolvedValue({ created: true })
  mockNotify.mockReset().mockResolvedValue(undefined)
  mockAccountEmail.mockReset().mockResolvedValue(undefined)
  mockGetInvite.mockReset().mockResolvedValue({ id: 1, codeHash: 'h', codeUsedAt: null })
  mockSignUpWithInvite.mockReset().mockResolvedValue({
    status: 'created',
    user: { id: '7', username: 'newcook', email: 'sam@example.com' },
  })
})

describe('POST /api/users (invite-only)', () => {
  describe('uninvited email', () => {
    beforeEach(() => mockGetInvite.mockResolvedValue(null))

    it('returns exactly what POST /api/waitlist returns and creates no user', async () => {
      const users = await postUsers(req(valid))
      const waitlist = await postWaitlist(req({ email: valid.email }, 'http://localhost/api/waitlist'))
      expect(users.status).toBe(waitlist.status)
      expect(await users.text()).toBe(await waitlist.text())
      expect(mockSignUpWithInvite).not.toHaveBeenCalled()
    })

    it('adds the email to the waitlist and sends the waitlist notification, not the account email', async () => {
      await postUsers(req(valid))
      expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ email: valid.email }))
      while (afterCallbacks.length) await afterCallbacks.shift()!()
      expect(mockNotify).toHaveBeenCalledTimes(1)
      expect(mockAccountEmail).not.toHaveBeenCalled()
    })

    it('answers the same even when the username and password are invalid', async () => {
      const good = await postUsers(req(valid))
      const bad = await postUsers(req({ ...valid, username: 'x', password: 'short', code: undefined }))
      expect(bad.status).toBe(good.status)
      expect(await bad.text()).toBe(await good.text())
    })

    it('rejects a malformed email like the waitlist does', async () => {
      const res = await postUsers(req({ ...valid, email: 'nope' }))
      const waitlist = await postWaitlist(req({ email: 'nope' }, 'http://localhost/api/waitlist'))
      expect(res.status).toBe(400)
      expect(await res.text()).toBe(await waitlist.text())
    })
  })

  describe('invited email', () => {
    it('creates the account with the code and returns 201 without sending an email', async () => {
      const res = await postUsers(req(valid))
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: '7', username: 'newcook', email: 'sam@example.com' })
      expect(mockSignUpWithInvite).toHaveBeenCalledWith(expect.objectContaining({
        email: valid.email, username: 'newcook', code: 'the-code',
      }))
      expect(mockAccountEmail).not.toHaveBeenCalled()
      expect(mockJoin).not.toHaveBeenCalled()
    })

    it('returns the same 400 for a wrong, used or missing code', async () => {
      mockSignUpWithInvite.mockResolvedValue({ status: 'invalid-code' })
      const a = await postUsers(req(valid))
      const b = await postUsers(req({ ...valid, code: undefined }))
      expect(a.status).toBe(400)
      expect(b.status).toBe(400)
      const bodyA = await a.json()
      expect(bodyA.code).toBe('invalid_invite')
      expect(await b.json()).toEqual(bodyA)
    })

    it('treats a non-string code as missing', async () => {
      mockSignUpWithInvite.mockResolvedValue({ status: 'invalid-code' })
      await postUsers(req({ ...valid, code: 12345 }))
      expect(mockSignUpWithInvite).toHaveBeenCalledWith(expect.objectContaining({ code: undefined }))
    })

    it('validates username and password only for an invited email', async () => {
      const short = await postUsers(req({ ...valid, username: 'ab' }))
      expect(short.status).toBe(400)
      expect((await short.json()).error).toMatch(/username/i)
      const weak = await postUsers(req({ ...valid, password: 'short' }))
      expect(weak.status).toBe(400)
      expect(mockSignUpWithInvite).not.toHaveBeenCalled()
    })

    it('returns 400 with the message when the username or email is taken', async () => {
      mockSignUpWithInvite.mockRejectedValue(new Error('Username already in use'))
      const res = await postUsers(req(valid))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Username already in use' })
    })
  })
})

describe('POST /api/users: invite-accepted admin signal', () => {
  async function flush() {
    for (const fn of afterCallbacks.splice(0)) await fn()
  }

  it('records invite-accepted once for the new user, deferred with after()', async () => {
    const res = await postUsers(req(valid))
    expect(res.status).toBe(201)
    expect(mockRecord).not.toHaveBeenCalled()
    await flush()
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith('invite-accepted', 7)
  })

  it('records nothing for a wrong or used code', async () => {
    mockSignUpWithInvite.mockResolvedValue({ status: 'invalid-code' })
    await postUsers(req(valid))
    await flush()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('records nothing for an uninvited email', async () => {
    mockGetInvite.mockResolvedValue(null)
    await postUsers(req(valid))
    await flush()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('still answers 201 when recording fails', async () => {
    mockRecord.mockRejectedValue(new Error('db down'))
    const res = await postUsers(req(valid))
    await expect(flush()).resolves.toBeUndefined()
    expect(res.status).toBe(201)
  })
})
