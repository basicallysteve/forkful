import { describe, it, expect } from 'vitest'
import { assertWriteOk, describeSaveFailure, ForbiddenError, UnauthorizedError } from './errors'

const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response

describe('assertWriteOk', () => {
  it('does not throw on ok', () => {
    expect(() => assertWriteOk(res(200), 'x')).not.toThrow()
  })
  it('throws UnauthorizedError on 401', () => {
    expect(() => assertWriteOk(res(401), 'x')).toThrow(UnauthorizedError)
  })
  it('throws ForbiddenError on 403', () => {
    expect(() => assertWriteOk(res(403), 'x')).toThrow(ForbiddenError)
  })
  it('throws a plain Error on 500 that is neither unauthorized nor forbidden', () => {
    expect(() => assertWriteOk(res(500), 'x')).toThrow('x')
    expect(() => assertWriteOk(res(500), 'x')).not.toThrow(ForbiddenError)
    expect(() => assertWriteOk(res(500), 'x')).not.toThrow(UnauthorizedError)
  })
})

describe('describeSaveFailure', () => {
  const retry = 'Could not save. Check your connection and try again.'

  it('asks the user to sign in for 401', () => {
    expect(describeSaveFailure(new UnauthorizedError())).toMatch(/sign in/i)
  })
  it('mentions permission only for 403', () => {
    expect(describeSaveFailure(new ForbiddenError())).toMatch(/permission/i)
  })
  it('says the item is gone for 404', () => {
    const err = Object.assign(new Error('Failed to update recipe'), { status: 404 })
    expect(describeSaveFailure(err)).toMatch(/no longer exists|not found/i)
    expect(describeSaveFailure(err)).not.toMatch(/permission/i)
  })
  it('suggests retrying on a network failure (fetch rejects with TypeError)', () => {
    const msg = describeSaveFailure(new TypeError('Failed to fetch'))
    expect(msg).toBe(retry)
    expect(msg).not.toMatch(/permission/i)
  })
  it('suggests retrying on a 5xx', () => {
    const err = Object.assign(new Error('Failed to update recipe'), { status: 500 })
    expect(describeSaveFailure(err)).toBe(retry)
  })
  it('suggests retrying for unknown errors', () => {
    expect(describeSaveFailure('boom')).toBe(retry)
  })
})
