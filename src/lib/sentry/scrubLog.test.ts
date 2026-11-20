import { describe, it, expect } from 'vitest'
import { scrubLog } from './scrubLog'

const log = (over: Record<string, unknown> = {}) =>
  ({ level: 'info', message: 'hello', attributes: {}, ...over }) as Parameters<typeof scrubLog>[0]

describe('scrubLog', () => {
  it('keeps info, warn and error logs', () => {
    for (const level of ['info', 'warn', 'error', 'fatal']) {
      expect(scrubLog(log({ level }))).not.toBeNull()
    }
  })

  it('drops trace and debug logs so they do not burn quota', () => {
    expect(scrubLog(log({ level: 'trace' }))).toBeNull()
    expect(scrubLog(log({ level: 'debug' }))).toBeNull()
  })

  it('redacts sensitive attribute keys', () => {
    const result = scrubLog(
      log({ attributes: { email: 'a@b.c', password: 'x', resetToken: 'y', recipeId: 7 } }),
    )
    expect(result?.attributes).toEqual({
      email: '[redacted]',
      password: '[redacted]',
      resetToken: '[redacted]',
      recipeId: 7,
    })
  })

  it('does not mutate the original log', () => {
    const original = log({ attributes: { email: 'a@b.c' } })
    scrubLog(original)
    expect(original.attributes).toEqual({ email: 'a@b.c' })
  })
})
