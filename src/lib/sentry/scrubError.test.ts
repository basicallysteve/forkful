import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/core'
import { stripSqlParams, describeDbError, scrubEvent } from './scrubError'

const SQL = 'insert into "food_log_entries" ("user_id", "food") values ($1, $2)'
const DB_MESSAGE = `Failed query: ${SQL}\nparams: 2,food,8080,1,egg`

describe('stripSqlParams', () => {
  it('removes the params line but keeps the Failed query prefix and SQL text', () => {
    const out = stripSqlParams(DB_MESSAGE)
    expect(out.startsWith('Failed query: insert into "food_log_entries"')).toBe(true)
    expect(out).toContain(SQL)
    expect(out).not.toContain('params')
    expect(out).not.toContain('8080')
    expect(out).not.toContain('egg')
  })

  it('leaves non-database messages unchanged, even if they mention params', () => {
    expect(stripSqlParams('boom')).toBe('boom')
    expect(stripSqlParams('bad request\nparams: a,b')).toBe('bad request\nparams: a,b')
  })
})

describe('describeDbError', () => {
  it('returns the operation and table for a database error', () => {
    expect(describeDbError(DB_MESSAGE)).toEqual({ dbOperation: 'insert', dbTable: 'food_log_entries' })
  })
  it('returns nothing for other errors', () => {
    expect(describeDbError('boom')).toEqual({})
  })
})

describe('scrubEvent', () => {
  it('strips params from exception values and the event message', () => {
    const event = {
      type: undefined,
      message: DB_MESSAGE,
      exception: { values: [{ type: 'Error', value: DB_MESSAGE }, { type: 'Error', value: 'other' }] },
    } as unknown as ErrorEvent
    const out = scrubEvent(event)
    expect(out.message).not.toContain('8080')
    expect(out.message).toContain('Failed query:')
    expect(out.exception?.values?.[0].value).not.toContain('8080')
    expect(out.exception?.values?.[0].value).toContain(SQL)
    expect(out.exception?.values?.[1].value).toBe('other')
  })

  it('returns events without messages unchanged', () => {
    const event = { type: undefined } as unknown as ErrorEvent
    expect(scrubEvent(event)).toEqual(event)
  })
})
