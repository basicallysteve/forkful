import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { getSessionUser } from '@/lib/auth'
import { createAccountFeedback } from '@/lib/users'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/users', () => ({ createAccountFeedback: vi.fn() }))
vi.mock('@/lib/TaskRunner', () => ({
  taskRunner: { run: vi.fn((fn: () => unknown) => fn()) },
}))

function makeRequest(id: string, body: Record<string, unknown>) {
  return {
    request: new Request(`http://localhost/api/users/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/users/[id]/feedback — auth', () => {
  it('returns 401 when not logged in', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)
    const { request, params } = makeRequest('1', { action: 'deactivated', reasons: [] })

    const res = await POST(request, { params })

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 403 when session user does not match id param', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
    const { request, params } = makeRequest('99', { action: 'deactivated', reasons: [] })

    const res = await POST(request, { params })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Forbidden')
  })
})

describe('POST /api/users/[id]/feedback — validation', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('returns 400 for an invalid action', async () => {
    const { request, params } = makeRequest('42', { action: 'suspended', reasons: [] })

    const res = await POST(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid action')
    expect(createAccountFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 when reasons is not an array', async () => {
    const { request, params } = makeRequest('42', { action: 'deactivated', reasons: 'Missing features' })

    const res = await POST(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid reasons')
    expect(createAccountFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 when reasons contains an invalid value', async () => {
    const { request, params } = makeRequest('42', { action: 'deactivated', reasons: ['Not a valid reason'] })

    const res = await POST(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid reasons')
    expect(createAccountFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 when comment is not a string', async () => {
    const { request, params } = makeRequest('42', {
      action: 'deactivated',
      reasons: ['Missing features'],
      comment: 42,
    })

    const res = await POST(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid comment')
    expect(createAccountFeedback).not.toHaveBeenCalled()
  })
})

describe('POST /api/users/[id]/feedback — success', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    ;(createAccountFeedback as Mock).mockResolvedValue(undefined)
  })

  it('saves feedback with no comment and returns ok', async () => {
    const { request, params } = makeRequest('42', {
      action: 'deactivated',
      reasons: ['Not using it enough', 'Privacy concerns'],
    })

    const res = await POST(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(createAccountFeedback).toHaveBeenCalledWith({
      userId: 42,
      action: 'deactivated',
      reasons: ['Not using it enough', 'Privacy concerns'],
      comment: undefined,
    })
  })

  it('saves feedback with a comment and returns ok', async () => {
    const { request, params } = makeRequest('42', {
      action: 'deleted',
      reasons: ['Other'],
      comment: 'Found a better app',
    })

    const res = await POST(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(createAccountFeedback).toHaveBeenCalledWith({
      userId: 42,
      action: 'deleted',
      reasons: ['Other'],
      comment: 'Found a better app',
    })
  })

  it('accepts empty reasons array', async () => {
    const { request, params } = makeRequest('42', {
      action: 'deleted',
      reasons: [],
    })

    const res = await POST(request, { params })

    expect(res.status).toBe(200)
    expect(createAccountFeedback).toHaveBeenCalledWith({
      userId: 42,
      action: 'deleted',
      reasons: [],
      comment: undefined,
    })
  })

  it('accepts null comment', async () => {
    const { request, params } = makeRequest('42', {
      action: 'deactivated',
      reasons: ['Missing features'],
      comment: null,
    })

    const res = await POST(request, { params })

    expect(res.status).toBe(200)
    expect(createAccountFeedback).toHaveBeenCalledWith({
      userId: 42,
      action: 'deactivated',
      reasons: ['Missing features'],
      comment: undefined,
    })
  })
})
