import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const send = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null })
const constructedWith: Array<string | undefined> = []
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
    constructor(key?: string) {
      constructedWith.push(key)
    }
  },
}))
vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), captureError: vi.fn() }))

import { sendPasswordResetEmail, sendUserAccountCreationEmail, sendWaitlistNotificationEmail, sendInviteEmail } from '@/lib/email'
import { logInfo } from '@/lib/logger'

describe('email send guard', () => {
  beforeEach(() => {
    send.mockClear()
    constructedWith.length = 0
    vi.mocked(logInfo).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'prod-key')
    vi.stubEnv('RESEND_SANDBOX_API_KEY', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([undefined, 'preview', 'development', 'Production', ''])(
    'suppresses and logs when VERCEL_ENV is %j',
    async (env) => {
      if (env === undefined) delete process.env.VERCEL_ENV
      else vi.stubEnv('VERCEL_ENV', env)
      await sendPasswordResetEmail('a@example.com', 'https://x.test/reset')
      expect(send).not.toHaveBeenCalled()
      expect(logInfo).toHaveBeenCalledTimes(1)
      const [message, attrs] = vi.mocked(logInfo).mock.calls[0]
      expect(JSON.stringify([message, attrs])).not.toContain('a@example.com')
      expect(attrs).toMatchObject({ template: 'password-reset' })
    },
  )

  it('sends exactly once when VERCEL_ENV is production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendPasswordResetEmail('a@example.com', 'https://x.test/reset')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'a@example.com' })
    expect(logInfo).not.toHaveBeenCalled()
  })

  it('guards every email function, not just password reset', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await sendUserAccountCreationEmail('someone')
    expect(send).not.toHaveBeenCalled()
    expect(logInfo).toHaveBeenCalledTimes(1)
  })

  it('routes the waitlist notification through the guard without logging the visitor email', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await sendWaitlistNotificationEmail({ email: 'visitor@example.com', name: 'Visitor', marketingEmailOptIn: false })
    expect(send).not.toHaveBeenCalled()
    const [message, attrs] = vi.mocked(logInfo).mock.calls[0]
    expect(attrs).toMatchObject({ template: 'waitlist-notification' })
    expect(JSON.stringify([message, attrs])).not.toContain('visitor@example.com')
  })

  it('sends the waitlist notification to the admin once in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendWaitlistNotificationEmail({ email: 'visitor@example.com', name: null, marketingEmailOptIn: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'steven@eatforkful.com' })
  })

  describe('sandbox key outside production', () => {
    it.each([undefined, 'preview', 'development', 'Production', ''])(
      'sends via the sandbox key, never the production key, when VERCEL_ENV is %j',
      async (env) => {
        if (env === undefined) delete process.env.VERCEL_ENV
        else vi.stubEnv('VERCEL_ENV', env)
        vi.stubEnv('RESEND_SANDBOX_API_KEY', 'sandbox-key')
        await sendPasswordResetEmail('a@example.com', 'https://x.test/reset')
        expect(constructedWith).toEqual(['sandbox-key'])
        expect(send).toHaveBeenCalledTimes(1)
        expect(logInfo).toHaveBeenCalledTimes(1)
        const [message, attrs] = vi.mocked(logInfo).mock.calls[0]
        expect(message).toBe('Email sent via sandbox key outside production')
        expect(attrs).toEqual({ template: 'password-reset' })
        expect(JSON.stringify([message, attrs])).not.toContain('a@example.com')
      },
    )

    it('suppresses when the sandbox key is unset', async () => {
      vi.stubEnv('VERCEL_ENV', 'preview')
      delete process.env.RESEND_SANDBOX_API_KEY
      await sendPasswordResetEmail('a@example.com', 'https://x.test/reset')
      expect(constructedWith).toEqual([])
      expect(send).not.toHaveBeenCalled()
    })

    it('production ignores the sandbox key and uses the production key', async () => {
      vi.stubEnv('VERCEL_ENV', 'production')
      vi.stubEnv('RESEND_SANDBOX_API_KEY', 'sandbox-key')
      await sendPasswordResetEmail('a@example.com', 'https://x.test/reset')
      expect(constructedWith).toEqual(['prod-key'])
      expect(send).toHaveBeenCalledTimes(1)
      expect(logInfo).not.toHaveBeenCalled()
    })
  })
})

describe('sendInviteEmail', () => {
  beforeEach(() => {
    send.mockClear()
    vi.mocked(logInfo).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'prod-key')
    vi.stubEnv('RESEND_SANDBOX_API_KEY', '')
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends one Invite Email to the invitee in production, with the code only in the body', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendInviteEmail({ to: 'pat@example.com', code: 'RAW_CODE' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.to).toBe('pat@example.com')
    expect(payload.subject).not.toContain('RAW_CODE')
    expect(JSON.stringify(payload.react.props)).toContain('code=RAW_CODE')
  })

  it('suppresses the Invite Email outside production and logs neither address nor code', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await sendInviteEmail({ to: 'pat@example.com', code: 'RAW_CODE' })
    expect(send).not.toHaveBeenCalled()
    const logged = JSON.stringify(vi.mocked(logInfo).mock.calls)
    expect(logged).toContain('invite')
    expect(logged).not.toContain('pat@example.com')
    expect(logged).not.toContain('RAW_CODE')
  })
})
