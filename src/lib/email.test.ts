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

import { sendPasswordResetEmail, sendUserAccountCreationEmail, sendWaitlistNotificationEmail, sendInviteEmail, sendWaitlistNoticeEmail, sendAdminSignalEmail } from '@/lib/email'
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

  it('rejects when Resend resolves an error, without the address, code or payload in the message', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    send.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'bad to pat@example.com RAW_CODE', statusCode: 429 },
    })
    const failure = await sendInviteEmail({ to: 'pat@example.com', code: 'RAW_CODE' }).then(() => null, (e: Error) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure!.message).toContain('rate_limit_exceeded')
    expect(failure!.message).not.toMatch(/pat@example|RAW_CODE/)
  })

  it('still resolves for existing callers when Resend resolves an error (only the invite path checks)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    send.mockResolvedValueOnce({ data: null, error: { name: 'x', message: 'y', statusCode: 500 } })
    await expect(sendPasswordResetEmail('a@example.com', 'https://x.test/reset')).resolves.toBeUndefined()
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

describe('sendWaitlistNoticeEmail', () => {
  beforeEach(() => {
    send.mockClear()
    vi.mocked(logInfo).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'prod-key')
    vi.stubEnv('RESEND_SANDBOX_API_KEY', '')
    vi.stubEnv('AUTH_SECRET', 'test-secret')
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the notice to the user in production with a signed leave link in the body', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendWaitlistNoticeEmail({ to: 'pat@example.com', username: 'pat' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.to).toBe('pat@example.com')
    expect(payload.subject).toBe("You're on the EatForkful waitlist")
    const props = JSON.stringify(payload.react.props)
    expect(props).toContain('"Hi ","pat"')
    expect(props).toContain('/waitlist/leave?token=')
    expect(payload.text).toContain('https://app.example.com/waitlist/leave?token=')
  })

  it('suppresses the notice outside production and logs neither address nor username', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await sendWaitlistNoticeEmail({ to: 'pat@example.com', username: 'patsy' })
    expect(send).not.toHaveBeenCalled()
    const logged = JSON.stringify(vi.mocked(logInfo).mock.calls)
    expect(logged).toContain('waitlist-notice')
    expect(logged).not.toContain('pat@example.com')
    expect(logged).not.toContain('patsy')
  })

  it('rejects when Resend resolves an error, without the address in the message', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    send.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'bad to pat@example.com', statusCode: 429 },
    })
    const failure = await sendWaitlistNoticeEmail({ to: 'pat@example.com', username: 'pat' }).then(() => null, (e: Error) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure!.message).toContain('rate_limit_exceeded')
    expect(failure!.message).not.toContain('pat@example.com')
  })
})

describe('sendAdminSignalEmail', () => {
  const at = new Date('2026-11-24T15:42:00Z')
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

  it('sends one immediate email with the kind subject and the full admin URL in the plain text', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendAdminSignalEmail({ to: 'admin@example.com', events: [{ kind: 'review-report', createdAt: at }], previousSentAt: null })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.to).toBe('admin@example.com')
    expect(payload.subject).toBe('EatForkful: New Review Report')
    expect(payload.text).toContain('https://app.example.com/admin/reports')
  })

  it('sends a summary with the total in the subject when several events are held', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await sendAdminSignalEmail({
      to: 'admin@example.com',
      events: [{ kind: 'review-report', createdAt: at }, { kind: 'feedback', createdAt: at }],
      previousSentAt: new Date('2026-11-24T15:30:00Z'),
    })
    const payload = send.mock.calls[0][0]
    expect(payload.subject).toBe('EatForkful: 2 things need your attention')
    expect(payload.text).toContain('1 Review Report')
    expect(payload.text).toContain('1 New Feedback')
  })

  it('goes through the send guard: nothing is sent outside production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await sendAdminSignalEmail({ to: 'admin@example.com', events: [{ kind: 'review-report', createdAt: at }], previousSentAt: null })
    expect(send).not.toHaveBeenCalled()
    expect(logInfo).toHaveBeenCalledTimes(1)
  })

  it('rejects when Resend resolves an error, without the address in the message', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    send.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'bad to admin@example.com', statusCode: 429 } })
    const failure = await sendAdminSignalEmail({ to: 'admin@example.com', events: [{ kind: 'feedback', createdAt: at }], previousSentAt: null })
      .then(() => null, (e: Error) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure?.message).not.toContain('admin@example.com')
  })
})
