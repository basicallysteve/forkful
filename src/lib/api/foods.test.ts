import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetchFoods, apiFetchFood, apiCreateFood, apiUpdateFood, apiDeleteFood } from './foods'
import { UnauthorizedError, isUnauthorizedError } from './errors'
import type { Food } from '@/types/Food'

const mockFood: Food = {
  id: 1,
  name: 'Ham',
  calories: 75,
  protein: 5,
  carbs: 1,
  fat: 6,
  fiber: 0,
  servingSize: 1,
  servingUnit: 'slice',
  measurements: [{ unit: 'slice' }, { unit: 'oz' }, { unit: 'g' }],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetchFoods', () => {
  it('fetches all foods with no params', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockFood],
    } as Response)
    const result = await apiFetchFoods()
    expect(result).toEqual([mockFood])
    expect(fetch).toHaveBeenCalledWith('/api/foods')
  })

  it('appends search query param', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response)
    await apiFetchFoods({ search: 'ham' })
    expect(fetch).toHaveBeenCalledWith('/api/foods?search=ham')
  })

  it('appends sortBy and sortDir params', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response)
    await apiFetchFoods({ sortBy: 'calories', sortDir: 'desc' })
    expect(fetch).toHaveBeenCalledWith('/api/foods?sortBy=calories&sortDir=desc')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiFetchFoods()).rejects.toThrow('Failed to fetch foods')
  })
})

describe('apiFetchFood', () => {
  it('fetches a single food by slug', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockFood } as Response)
    const result = await apiFetchFood('ham')
    expect(result).toEqual(mockFood)
    expect(fetch).toHaveBeenCalledWith('/api/foods/ham')
  })

  it('returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    const result = await apiFetchFood('nonexistent')
    expect(result).toBeNull()
  })
})

describe('apiCreateFood', () => {
  it('posts food data and returns created food', async () => {
    const {...foodData } = mockFood
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFood,
    } as Response)
    const result = await apiCreateFood(foodData)
    expect(result).toEqual(mockFood)
    expect(fetch).toHaveBeenCalledWith('/api/foods', expect.objectContaining({ method: 'POST' }))
  })
})

describe('apiUpdateFood', () => {
  it('puts food data and returns updated food', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockFood,
    } as Response)
    const result = await apiUpdateFood(mockFood)
    expect(result).toEqual(mockFood)
    expect(fetch).toHaveBeenCalledWith('/api/foods/ham', expect.objectContaining({ method: 'PUT' }))
  })
})

describe('401 handling', () => {
  const unauthorized = () => ({ ok: false, status: 401 }) as Response

  it('apiCreateFood throws UnauthorizedError on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(unauthorized())
    await expect(apiCreateFood(mockFood)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('apiUpdateFood throws UnauthorizedError on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(unauthorized())
    await expect(apiUpdateFood(mockFood)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('apiDeleteFood throws UnauthorizedError on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(unauthorized())
    await expect(apiDeleteFood('ham')).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('other failures stay plain errors, not UnauthorizedError', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    const err = await apiCreateFood(mockFood).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnauthorizedError)
  })

  it('isUnauthorizedError recognises the error', () => {
    expect(isUnauthorizedError(new UnauthorizedError())).toBe(true)
    expect(isUnauthorizedError(new Error('x'))).toBe(false)
  })
})

describe('apiDeleteFood', () => {
  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeleteFood('ham')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/foods/ham', { 'credentials': 'same-origin', method: 'DELETE' })
  })
})
