import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ApiError,
  apiFetch,
  assertWriteOk,
  describeSaveFailure,
  ensureOk,
  errorMessageFor,
  ForbiddenError,
  isUnauthorizedError,
  UnauthorizedError,
  type ApiErrorKind,
} from './errors'

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

describe('ensureOk', () => {
  const failing = (status: number, body?: unknown) =>
    ({
      ok: false,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError('no body')
        return body
      },
    }) as unknown as Response

  it('resolves for an ok response and for listed ok statuses', async () => {
    await expect(ensureOk({ ok: true, status: 200 } as Response, 'x')).resolves.toBeUndefined()
    await expect(ensureOk(failing(404), 'x', [404])).resolves.toBeUndefined()
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [400, 'invalid'],
    [409, 'invalid'],
    [422, 'invalid'],
    [500, 'server'],
    [503, 'server'],
  ])('maps status %i to kind %s and keeps the status', async (status, kind) => {
    const err = await ensureOk(failing(status), 'Failed to x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(status)
    expect(err.kind).toBe(kind)
  })

  it("uses the server's {error} message when there is one", async () => {
    const err = await ensureOk(failing(400, { error: 'Title is required' }), 'Failed to create recipe').catch((e) => e)
    expect(err.message).toBe('Title is required')
  })

  it('falls back to the given message when the body is missing, not JSON or has no error string', async () => {
    expect((await ensureOk(failing(500), 'Failed to create recipe').catch((e) => e)).message).toBe('Failed to create recipe')
    expect((await ensureOk(failing(500, { error: 42 }), 'Failed to create recipe').catch((e) => e)).message).toBe('Failed to create recipe')
    expect((await ensureOk({ ok: false, status: 500 } as Response, 'Failed to create recipe').catch((e) => e)).message).toBe('Failed to create recipe')
  })

  it('401 and 403 still satisfy the older error classes', async () => {
    expect(await ensureOk(failing(401), 'x').catch((e) => e)).toBeInstanceOf(UnauthorizedError)
    expect(await ensureOk(failing(403), 'x').catch((e) => e)).toBeInstanceOf(ForbiddenError)
  })
})

describe('isUnauthorizedError', () => {
  it('recognises any ApiError of kind unauthorized, and nothing else', () => {
    expect(isUnauthorizedError(new ApiError({ status: 401, kind: 'unauthorized', message: 'x' }))).toBe(true)
    expect(isUnauthorizedError(new ApiError({ status: 403, kind: 'forbidden', message: 'x' }))).toBe(false)
    expect(isUnauthorizedError(new Error('x'))).toBe(false)
  })
})

describe('apiFetch', () => {
  afterEach(() => vi.restoreAllMocks())

  it('turns a network TypeError into an ApiError of kind network', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await apiFetch('/api/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.kind).toBe('network')
  })

  it('passes the response through otherwise', async () => {
    const response = { ok: true, status: 200 } as Response
    global.fetch = vi.fn().mockResolvedValue(response)
    await expect(apiFetch('/api/x')).resolves.toBe(response)
  })
})

describe('errorMessageFor', () => {
  const action = 'save this recipe'
  const api = (status: number, kind: ApiErrorKind, message = 'server text') => new ApiError({ status, kind, message })

  it.each([
    ['401', api(401, 'unauthorized'), 'Please sign in to save this recipe.'],
    ['403', api(403, 'forbidden'), 'You do not have permission to save this recipe.'],
    ['404', api(404, 'not_found'), 'This item no longer exists. Refresh the page and try again.'],
    ['400 uses the server message', api(400, 'invalid', 'Title is required'), 'Title is required'],
    ['5xx', api(500, 'server'), 'Could not save this recipe because something went wrong on our side. Please try again in a moment.'],
    ['network', api(0, 'network'), 'Could not save this recipe. Check your connection and try again.'],
    ['a raw network TypeError', new TypeError('Failed to fetch'), 'Could not save this recipe. Check your connection and try again.'],
    ['a legacy UnauthorizedError', new UnauthorizedError(), 'Please sign in to save this recipe.'],
    ['an unknown error', new Error('boom'), 'Could not save this recipe. Please try again.'],
    ['a non-error value', 'nope', 'Could not save this recipe. Please try again.'],
  ])('%s', (_name, err, expected) => {
    expect(errorMessageFor(err, action)).toBe(expected)
  })

  it('only 403 mentions permission', () => {
    for (const e of [api(401, 'unauthorized'), api(404, 'not_found'), api(500, 'server'), api(0, 'network')]) {
      expect(errorMessageFor(e, action)).not.toMatch(/permission/i)
    }
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
