import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiCreateShoppingListItem,
  apiDeleteShoppingListItem,
  apiFetchShoppingListItems,
  apiSplitShoppingListItem,
  apiUpdateShoppingListItemDetails,
  apiUpdateShoppingListItemStatus,
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
  linePrice: null,
  expirationDate: null,
  addedDate: '2026-01-01T00:00:00.000Z',
}

const mockParsedItem: ShoppingListItem = {
  ...mockRawItem,
  expirationDate: null,
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

describe('apiDeleteShoppingListItem', () => {
  it('sends a DELETE to the item endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)

    await apiDeleteShoppingListItem(3)

    expect(fetch).toHaveBeenCalledWith('/api/shopping-list/3', { method: 'DELETE' })
  })

  it('resolves on a 204 No Content response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 204 } as Response)

    await expect(apiDeleteShoppingListItem(3)).resolves.toBeUndefined()
  })

  it('throws on a non-ok, non-204 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)

    await expect(apiDeleteShoppingListItem(3)).rejects.toThrow('Failed to delete shopping list item')
  })
})

describe('apiUpdateShoppingListItemStatus', () => {
  it('PATCHes the status and resolves without reading a body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)

    await expect(apiUpdateShoppingListItemStatus(1, 'bought')).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith('/api/shopping-list/1', expect.objectContaining({ method: 'PATCH' }))
    expect(postedBody()).toEqual({ status: 'bought' })
  })

  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(apiUpdateShoppingListItemStatus(1, 'unavailable')).rejects.toThrow('Failed to update shopping list item status')
  })
})

describe('apiUpdateShoppingListItemDetails', () => {
  it('PATCHes the total price and serialises the expiration to ISO, parsing the returned line', async () => {
    const rawUpdated = { ...mockRawItem, linePrice: 4.5, expirationDate: '2026-02-01T00:00:00.000Z' }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => rawUpdated } as Response)

    const result = await apiUpdateShoppingListItemDetails(1, {
      linePrice: 4.5,
      expirationDate: new Date('2026-02-01T00:00:00.000Z'),
    })

    expect(fetch).toHaveBeenCalledWith('/api/shopping-list/1', expect.objectContaining({ method: 'PATCH' }))
    expect(postedBody()).toEqual({ linePrice: 4.5, expirationDate: '2026-02-01T00:00:00.000Z' })
    expect(result.linePrice).toBe(4.5)
    expect(result.expirationDate).toEqual(new Date('2026-02-01T00:00:00.000Z'))
  })

  it('sends explicit nulls to clear the price and expiration', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawItem } as Response)

    await apiUpdateShoppingListItemDetails(1, { linePrice: null, expirationDate: null })

    expect(postedBody()).toEqual({ linePrice: null, expirationDate: null })
  })

  it('omits keys that are not provided so unspecified fields stay unchanged', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawItem } as Response)

    await apiUpdateShoppingListItemDetails(1, { linePrice: 3 })

    expect(postedBody()).toEqual({ linePrice: 3 })
  })

  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(apiUpdateShoppingListItemDetails(1, { linePrice: 1 })).rejects.toThrow('Failed to update shopping list item details')
  })
})

describe('apiSplitShoppingListItem', () => {
  it('POSTs the portions with ISO dates and parses the returned lines', async () => {
    const rawA = { ...mockRawItem, id: 1, amount: 1, expirationDate: '2026-02-01T00:00:00.000Z' }
    const rawB = { ...mockRawItem, id: 2, amount: 1, expirationDate: null }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [rawA, rawB] } as Response)

    const result = await apiSplitShoppingListItem(1, {
      portions: [
        { amount: 1, expirationDate: new Date('2026-02-01T00:00:00.000Z') },
        { amount: 1, expirationDate: null },
      ],
      linePrice: 6,
    })

    expect(fetch).toHaveBeenCalledWith('/api/shopping-list/1/split', expect.objectContaining({ method: 'POST' }))
    expect(postedBody()).toEqual({
      portions: [
        { amount: 1, expirationDate: '2026-02-01T00:00:00.000Z' },
        { amount: 1, expirationDate: null },
      ],
      linePrice: 6,
    })
    expect(result).toHaveLength(2)
    expect(result[0].expirationDate).toEqual(new Date('2026-02-01T00:00:00.000Z'))
    expect(result[1].expirationDate).toBeNull()
  })

  it('omits linePrice when it is not provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockRawItem] } as Response)

    await apiSplitShoppingListItem(1, { portions: [{ amount: 2, expirationDate: null }] })

    expect(postedBody()).toEqual({ portions: [{ amount: 2, expirationDate: null }] })
  })

  it('throws on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(
      apiSplitShoppingListItem(1, { portions: [{ amount: 1, expirationDate: null }] })
    ).rejects.toThrow('Failed to split shopping list item')
  })
})
