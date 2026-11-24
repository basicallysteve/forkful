import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { flagFn } = vi.hoisted(() => ({ flagFn: vi.fn() }))
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

  it('treats a flag value that is not exactly false as waitlist mode', async () => {
    flagFn.mockResolvedValue(undefined)
    expect(await isInviteOnly()).toBe(true)
    flagFn.mockResolvedValue('false')
    expect(await isInviteOnly()).toBe(true)
  })

  describe('INVITE_ONLY_ACCESS override (local dev and Preview), fails closed', () => {
    it('only the exact string "false" opens sign-up, without asking the flag', async () => {
      process.env.INVITE_ONLY_ACCESS = 'false'
      expect(await isInviteOnly()).toBe(false)
      expect(flagFn).not.toHaveBeenCalled()
    })

    it('"true" keeps the waitlist without asking the flag', async () => {
      process.env.INVITE_ONLY_ACCESS = 'true'
      expect(await isInviteOnly()).toBe(true)
      expect(flagFn).not.toHaveBeenCalled()
    })

    it.each(['FALSE', '0', 'off', ' false', 'maybe'])('%j is set but not "false": waitlist mode, flag not asked', async (value) => {
      process.env.INVITE_ONLY_ACCESS = value
      flagFn.mockResolvedValue(false)
      expect(await isInviteOnly()).toBe(true)
      expect(flagFn).not.toHaveBeenCalled()
    })

    it.each([undefined, ''])('%j (unset or empty) falls through to the flag', async (value) => {
      if (value === undefined) delete process.env.INVITE_ONLY_ACCESS
      else process.env.INVITE_ONLY_ACCESS = value
      flagFn.mockResolvedValue(false)
      expect(await isInviteOnly()).toBe(false)
    })

    it('is ignored in production, which reads only the Vercel flag', async () => {
      vi.stubEnv('VERCEL_ENV', 'production')
      process.env.INVITE_ONLY_ACCESS = 'false'
      flagFn.mockResolvedValue(true)
      expect(await isInviteOnly()).toBe(true)
      expect(flagFn).toHaveBeenCalled()
      vi.unstubAllEnvs()
    })

    it('still applies on Preview', async () => {
      vi.stubEnv('VERCEL_ENV', 'preview')
      process.env.INVITE_ONLY_ACCESS = 'false'
      expect(await isInviteOnly()).toBe(false)
      vi.unstubAllEnvs()
    })
  })
})
