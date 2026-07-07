import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiCreateShoppingListItem,
  apiFetchShoppingListItems,
} from './shoppingList'
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
  name: 'Chicken Breast',
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

function postedBody(): Record<string, unknown> {
  const call = vi.mocked(fetch).mock.calls[0]
  return JSON.parse((call[1] as RequestInit).body as string)
}

describe('apiCreateShoppingListItem', () => {
  it('posts a food item and parses the created item', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawItem } as Response)

    const result = await apiCreateShoppingListItem({ sourceType: 'food', foodId: 1, amount: 2, unit: 'oz' })

    expect(result).toEqual(mockParsedItem)
    expect(fetch).toHaveBeenCalledWith('/api/shopping-list', expect.objectContaining({ method: 'POST' }))
    expect(postedBody()).toEqual({ sourceType: 'food', foodId: 1, amount: 2, unit: 'oz' })
  })

  it('posts a product item', async () => {
    const rawProductItem = { ...mockRawItem, sourceType: 'product' as const, food: undefined, product: { ...mockFood } }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => rawProductItem } as Response)

    const result = await apiCreateShoppingListItem({ sourceType: 'product', productId: 7, amount: 3, unit: 'oz' })

    expect(result.sourceType).toBe('product')
    expect(postedBody()).toEqual({ sourceType: 'product', productId: 7, amount: 3, unit: 'oz' })
  })

  it('posts a freeform item with an optional unit', async () => {
    const rawFreeform = { id: 9, sourceType: 'freeform' as const, status: 'to_buy' as const, name: 'Trash bags', amount: 1, unit: null, addedDate: '2026-01-01T00:00:00.000Z' }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => rawFreeform } as Response)

    const result = await apiCreateShoppingListItem({ sourceType: 'freeform', name: 'Trash bags', amount: 1 })

    expect(result.name).toBe('Trash bags')
    expect(result.unit).toBeNull()
    expect(postedBody()).toEqual({ sourceType: 'freeform', name: 'Trash bags', amount: 1 })
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(apiCreateShoppingListItem({ sourceType: 'food', foodId: 1, amount: 1, unit: 'g' })).rejects.toThrow('Failed to create shopping list item')
  })
})
