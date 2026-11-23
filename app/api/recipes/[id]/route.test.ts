import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn().mockResolvedValue({ userId: 1 }) }))
vi.mock('@/lib/recipes', () => ({
  getRecipeByShortId: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: <T,>(fn: () => Promise<T>) => fn() } }))

import { PUT } from './route'
import { getRecipeByShortId, updateRecipe } from '@/lib/recipes'

function put() {
  return PUT(
    new Request('http://localhost/api/recipes/abc', { method: 'PUT', body: JSON.stringify({ name: 'Test X', ingredients: [] }) }),
    { params: Promise.resolve({ id: 'abc' }) },
  )
}

describe('PUT /api/recipes/[id]', () => {
  beforeEach(() => {
    vi.mocked(getRecipeByShortId).mockReset().mockResolvedValue({ id: 5, userId: 1 } as never)
    vi.mocked(updateRecipe).mockReset()
  })

  it('answers 400 (not 500) when an ingredient references an unknown food', async () => {
    vi.mocked(updateRecipe).mockImplementation(() => { throw Object.assign(new Error('fk violation'), { code: '23503' }) })
    const res = await put()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('One or more ingredients reference a food that does not exist.')
  })

  it('also recognises the violation when the driver error is wrapped as `cause`', async () => {
    vi.mocked(updateRecipe).mockImplementation(() => { throw new Error('Failed query', { cause: Object.assign(new Error('fk'), { code: '23503' }) }) })
    expect((await put()).status).toBe(400)
  })

  it('still lets unrelated errors surface as server errors', async () => {
    vi.mocked(updateRecipe).mockImplementation(() => { throw new Error('boom') })
    await expect(put()).rejects.toThrow('boom')
  })

  it('returns the updated recipe on success', async () => {
    vi.mocked(updateRecipe).mockResolvedValue({ id: 5, name: 'Test X' } as never)
    const res = await put()
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Test X')
  })
})
