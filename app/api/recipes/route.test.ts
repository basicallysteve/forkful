import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn().mockResolvedValue({ userId: 1 }) }))
vi.mock('@/lib/recipes', () => ({ getRecipes: vi.fn(), createRecipe: vi.fn() }))

vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: <T,>(fn: () => Promise<T>) => fn() } }))

import { POST } from './route'
import { createRecipe } from '@/lib/recipes'

function post() {
  return POST(new Request('http://localhost/api/recipes', { method: 'POST', body: JSON.stringify({ name: 'Test X', ingredients: [] }) }))
}

describe('POST /api/recipes', () => {
  beforeEach(() => vi.mocked(createRecipe).mockReset())

  it('answers 400 (not 500) when an ingredient references an unknown food', async () => {
    vi.mocked(createRecipe).mockImplementation(() => { throw Object.assign(new Error('fk violation'), { code: '23503' }) })
    const res = await post()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/food/i)
  })

  it('also recognises the violation when the driver error is wrapped as `cause`', async () => {
    vi.mocked(createRecipe).mockImplementation(() => { throw new Error('Failed query', { cause: Object.assign(new Error('fk'), { code: '23503' }) }) })
    expect((await post()).status).toBe(400)
  })

})
