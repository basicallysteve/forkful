import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const send = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))
vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), captureError: vi.fn() }))

import { sendPasswordResetEmail, sendUserAccountCreationEmail } from '@/lib/email'
import { logInfo } from '@/lib/logger'

describe('email send guard', () => {
  beforeEach(() => {
    send.mockClear()
    vi.mocked(logInfo).mockClear()
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
})
