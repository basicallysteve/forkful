import { describe, it, expect, vi, beforeEach } from 'vitest'

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(() => 'event-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@sentry/nextjs', () => sentry)

import { logInfo, logWarn, captureError } from './logger'

beforeEach(() => vi.clearAllMocks())

describe('logger', () => {
  it('logInfo and logWarn forward message and attributes to Sentry.logger', () => {
    logInfo('recipe imported', { recipeId: 3 })
    logWarn('usda slow', { ms: 900 })
    expect(sentry.logger.info).toHaveBeenCalledWith('recipe imported', { recipeId: 3 })
    expect(sentry.logger.warn).toHaveBeenCalledWith('usda slow', { ms: 900 })
  })

  it('captureError reports the exception tagged with the area and writes an error log', () => {
    const err = new Error('boom')
    captureError(err, { area: 'food-log', attributes: { foodId: 9 } })
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { area: 'food-log' },
      extra: { foodId: 9 },
    })
    expect(sentry.logger.error).toHaveBeenCalledWith('boom', {
      area: 'food-log',
      foodId: 9,
      errorName: 'Error',
    })
  })

  it('captureError handles non-Error throwables', () => {
    captureError('oops', { area: 'x' })
    expect(sentry.logger.error).toHaveBeenCalledWith('oops', { area: 'x', errorName: 'NonError' })
  })
})
