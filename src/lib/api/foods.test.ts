import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetchFoods, apiCreateFood, apiUpdateFood, apiDeleteFood } from './foods'
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
  it('returns foods from the API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockFood],
    } as Response)
    const foods = await apiFetchFoods()
    expect(foods).toEqual([mockFood])
    expect(fetch).toHaveBeenCalledWith('/api/foods')
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response)
    await expect(apiFetchFoods()).rejects.toThrow('Failed to fetch foods')
  })
})

describe('apiCreateFood', () => {
  it('posts food data and returns created food', async () => {
    const { id: _, ...foodData } = mockFood
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
    expect(fetch).toHaveBeenCalledWith('/api/foods/ham', { method: 'DELETE' })
  })
})
