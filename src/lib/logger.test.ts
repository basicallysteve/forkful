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

  describe('database errors', () => {
    const msg = 'Failed query: insert into "food_log_entries" ("user_id") values ($1)\nparams: 2,food,8080,1,egg'

    it('logs and captures without the bound params, keeping the Failed query prefix', () => {
      captureError(new Error(msg), { area: 'food-log' })
      const logged = sentry.logger.error.mock.calls[0] as unknown as [string, Record<string, unknown>]
      expect(logged[0]).toBe('Failed query: insert into "food_log_entries" ("user_id") values ($1)')
      expect(logged[1]).toMatchObject({ area: 'food-log', dbOperation: 'insert', dbTable: 'food_log_entries' })
      const captured = (sentry.captureException.mock.calls[0] as unknown as [Error])[0]
      expect(captured.message).toBe(logged[0])
      expect(captured.message).not.toContain('8080')
      expect(captured.stack ?? '').not.toContain('8080')
    })

    it('keeps $ replacement patterns in the message literal in the stack', () => {
      const err = new Error('Failed query: select $& from "foods"\nparams: 8080')
      captureError(err, { area: 'x' })
      const captured = (sentry.captureException.mock.calls[0] as unknown as [Error])[0]
      expect(captured.message).toBe('Failed query: select $& from "foods"')
      expect(captured.stack).toContain('Failed query: select $& from "foods"')
      expect(captured.stack ?? '').not.toContain('8080')
    })

    it('does not add db attributes to non-database errors', () => {
      captureError(new Error('boom'), { area: 'x' })
      expect(sentry.logger.error).toHaveBeenCalledWith('boom', { area: 'x', errorName: 'Error' })
    })
  })
})
