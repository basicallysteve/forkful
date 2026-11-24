import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const flagFn = vi.fn()
vi.mock('flags/next', () => ({ flag: () => flagFn }))
vi.mock('@flags-sdk/vercel', () => ({ vercelAdapter: {} }))

import { isInviteOnly } from './inviteOnly'

const ORIGINAL = process.env.INVITE_ONLY_ACCESS

beforeEach(() => {
  flagFn.mockReset()
  delete process.env.INVITE_ONLY_ACCESS
})
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.INVITE_ONLY_ACCESS
  else process.env.INVITE_ONLY_ACCESS = ORIGINAL
})

describe('isInviteOnly (the one reader of the invite-only-access flag, #374)', () => {
  it('returns the flag value: on', async () => {
    flagFn.mockResolvedValue(true)
    expect(await isInviteOnly()).toBe(true)
  })

  it('returns the flag value: off', async () => {
    flagFn.mockResolvedValue(false)
    expect(await isInviteOnly()).toBe(false)
  })

  it('fails closed (waitlist mode) when the flag cannot be evaluated', async () => {
    flagFn.mockRejectedValue(new Error('no connection'))
    expect(await isInviteOnly()).toBe(true)
  })

  it('passes the request to the flag, for the proxy where next/headers is unavailable', async () => {
    flagFn.mockResolvedValue(false)
    const request = { headers: new Headers() }
    await isInviteOnly(request)
    expect(flagFn).toHaveBeenCalledWith(request)
  })

  describe('INVITE_ONLY_ACCESS override (local dev and per-environment)', () => {
    it('"false" opens sign-up without asking the flag', async () => {
      process.env.INVITE_ONLY_ACCESS = 'false'
      expect(await isInviteOnly()).toBe(false)
      expect(flagFn).not.toHaveBeenCalled()
    })

    it('"true" keeps the waitlist without asking the flag', async () => {
      process.env.INVITE_ONLY_ACCESS = 'true'
      expect(await isInviteOnly()).toBe(true)
      expect(flagFn).not.toHaveBeenCalled()
    })

    it('ignores any other value and uses the flag', async () => {
      process.env.INVITE_ONLY_ACCESS = 'maybe'
      flagFn.mockResolvedValue(false)
      expect(await isInviteOnly()).toBe(false)
    })
  })
})
