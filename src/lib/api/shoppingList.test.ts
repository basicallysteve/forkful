import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiCreateShoppingListFoodItem, apiFetchShoppingListItems } from './shoppingList'
import type { ShoppingListItem } from '@/types/ShoppingList'

const mockFood = {
  id: 1,
  name: 'Chicken Breast',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }, { unit: 'oz' }],
}

const mockRawItem = {
  id: 1,
  sourceType: 'food' as const,
  status: 'to_buy' as const,
  food: mockFood,
  amount: 2,
  unit: 'oz',
  addedDate: '2026-01-01T00:00:00.000Z',
}

const mockParsedItem: ShoppingListItem = {
  ...mockRawItem,
  addedDate: new Date('2026-01-01T00:00:00.000Z'),
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetchShoppingListItems', () => {
  it('fetches shopping list items and parses dates', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockRawItem] } as Response)

    const result = await apiFetchShoppingListItems()

    expect(result).toEqual([mockParsedItem])
    expect(fetch).toHaveBeenCalledWith('/api/shopping-list')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)

    await expect(apiFetchShoppingListItems()).rejects.toThrow('Failed to fetch shopping list items')
  })
})

describe('apiCreateShoppingListFoodItem', () => {
  it('posts food item data and parses the created item', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawItem } as Response)

    const result = await apiCreateShoppingListFoodItem({
      foodId: 1,
      amount: 2,
      unit: 'oz',
    })

    expect(result).toEqual(mockParsedItem)
    expect(fetch).toHaveBeenCalledWith('/api/shopping-list', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(apiCreateShoppingListFoodItem({ foodId: 1, amount: 1, unit: 'g' })).rejects.toThrow('Failed to create shopping list item')
  })
})
