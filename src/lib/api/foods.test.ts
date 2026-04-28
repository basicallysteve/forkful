import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetchFoods, apiFetchFood, apiCreateFood, apiUpdateFood, apiDeleteFood } from './foods'
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
  measurements: ['slice', 'oz', 'g'],
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

describe('apiDeleteFood', () => {
  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeleteFood('ham')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/foods/ham', { 'credentials': 'same-origin', method: 'DELETE' })
  })
})
