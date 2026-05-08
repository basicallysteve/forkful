import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiFetchPantryItems,
  apiFetchPantryItem,
  apiCreatePantryItem,
  apiUpdatePantryItem,
  apiDeletePantryItem,
} from './pantry'
import type { PantryItem } from '@/types/PantryItem'

const mockPantryItem: PantryItem = {
  id: 1,
  food: {
    id: 1,
    name: 'Chicken Breast',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    servingSize: 100,
    servingUnit: 'g',
    measurements: ['g', 'oz'],
  },
  expirationDate: new Date('2026-06-01'),
  originalSize: { size: 2, unit: 'lb' },
  currentSize: { size: 1.5, unit: 'lb' },
  addedDate: new Date('2026-05-01'),
  status: 'good',
  frozenDate: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetchPantryItems', () => {
  it('fetches all pantry items', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockPantryItem],
    } as Response)
    const result = await apiFetchPantryItems()
    expect(result).toEqual([mockPantryItem])
    expect(fetch).toHaveBeenCalledWith('/api/pantry')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiFetchPantryItems()).rejects.toThrow('Failed to fetch pantry items')
  })
})

describe('apiFetchPantryItem', () => {
  it('fetches a single pantry item by id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPantryItem,
    } as Response)
    const result = await apiFetchPantryItem(1)
    expect(result).toEqual(mockPantryItem)
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1')
  })

  it('returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    const result = await apiFetchPantryItem(999)
    expect(result).toBeNull()
  })

  it('throws on other non-ok responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiFetchPantryItem(1)).rejects.toThrow('Failed to fetch pantry item')
  })
})

describe('apiCreatePantryItem', () => {
  it('posts pantry item data and returns the created item', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPantryItem,
    } as Response)
    const result = await apiCreatePantryItem({
      foodId: 1,
      originalSizeAmount: 2,
      originalSizeUnit: 'lb',
      currentSizeAmount: 1.5,
      currentSizeUnit: 'lb',
    })
    expect(result).toEqual(mockPantryItem)
    expect(fetch).toHaveBeenCalledWith('/api/pantry', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)
    await expect(
      apiCreatePantryItem({ foodId: 1, originalSizeAmount: 1, currentSizeAmount: 1 })
    ).rejects.toThrow('Failed to create pantry item')
  })
})

describe('apiUpdatePantryItem', () => {
  it('sends PUT with updated fields and returns updated item', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockPantryItem, currentSize: { size: 1, unit: 'lb' } }),
    } as Response)
    const result = await apiUpdatePantryItem(1, { currentSizeAmount: 1 })
    expect(result.currentSize.size).toBe(1)
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('can update frozenDate', async () => {
    const frozenDate = '2026-05-08T10:00:00.000Z'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockPantryItem, frozenDate }),
    } as Response)
    const result = await apiUpdatePantryItem(1, { frozenDate })
    expect(result.frozenDate).toBe(frozenDate)
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(apiUpdatePantryItem(999, {})).rejects.toThrow('Failed to update pantry item')
  })
})

describe('apiDeletePantryItem', () => {
  it('sends DELETE and resolves on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeletePantryItem(1)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1', { method: 'DELETE' })
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiDeletePantryItem(1)).rejects.toThrow('Failed to delete pantry item')
  })
})
