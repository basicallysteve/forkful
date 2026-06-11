import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { getSessionUser } from '@/lib/auth'
import { completeOnboarding } from '@/lib/users'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/users', () => ({ completeOnboarding: vi.fn() }))
vi.mock('@/lib/TaskRunner', () => ({
  taskRunner: { run: vi.fn((fn: () => unknown) => fn()) },
}))

function makeRequest(id: string, body: Record<string, unknown> = {}) {
  return {
    request: new Request(`http://localhost/api/users/${id}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'testuser' })
  ;(completeOnboarding as Mock).mockResolvedValue(undefined)
})

describe('POST /api/users/[id]/onboarding', () => {
  it('returns 401 when not authenticated', async () => {
    ;(getSessionUser as Mock).mockResolvedValue(null)
    const { request, params } = makeRequest('1')
    const res = await POST(request, { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when session user does not match route id', async () => {
    const { request, params } = makeRequest('99')
    const res = await POST(request, { params })
    expect(res.status).toBe(403)
  })

  it('saves preferences and returns ok on valid input', async () => {
    const { request, params } = makeRequest('1', {
      cuisinePreferences: ['Italian', 'Mexican'],
      dietaryRestrictions: ['Vegan'],
    })
    const res = await POST(request, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(completeOnboarding).toHaveBeenCalledWith(1, {
      cuisinePreferences: ['Italian', 'Mexican'],
      dietaryRestrictions: ['Vegan'],
    })
  })

  it('falls back to empty arrays when preferences are missing', async () => {
    const { request, params } = makeRequest('1', {})
    await POST(request, { params })
    expect(completeOnboarding).toHaveBeenCalledWith(1, {
      cuisinePreferences: [],
      dietaryRestrictions: [],
    })
  })

  it('strips non-string values from preference arrays', async () => {
    const { request, params } = makeRequest('1', {
      cuisinePreferences: [123, 'Italian'],
      dietaryRestrictions: ['Vegan'],
    })
    await POST(request, { params })
    expect(completeOnboarding).toHaveBeenCalledWith(1, {
      cuisinePreferences: [],
      dietaryRestrictions: ['Vegan'],
    })
  })
})
