import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiFetchPantryItems,
  apiFetchPantryItem,
  apiCreatePantryItem,
  apiUpdatePantryItem,
  apiDeletePantryItem,
} from './pantry'

const mockRaw = {
  id: 1,
  food: { id: 1, name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz'] },
  originalSize: { size: 16, unit: 'oz' },
  currentSize: { size: 8, unit: 'oz' },
  expirationDate: '2026-12-31T00:00:00.000Z',
  addedDate: '2026-01-01T00:00:00.000Z',
  status: 'good',
  frozenDate: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetchPantryItems', () => {
  it('fetches all pantry items and parses dates', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockRaw] } as Response)
    const result = await apiFetchPantryItems()
    expect(result).toHaveLength(1)
    expect(result[0].expirationDate).toBeInstanceOf(Date)
    expect(result[0].addedDate).toBeInstanceOf(Date)
    expect(result[0].frozenDate).toBeNull()
    expect(fetch).toHaveBeenCalledWith('/api/pantry')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiFetchPantryItems()).rejects.toThrow('Failed to fetch pantry items')
  })
})

describe('apiFetchPantryItem', () => {
  it('fetches a single pantry item and parses dates', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRaw } as Response)
    const result = await apiFetchPantryItem(1)
    expect(result).not.toBeNull()
    expect(result!.expirationDate).toBeInstanceOf(Date)
    expect(result!.addedDate).toBeInstanceOf(Date)
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1')
  })

  it('parses frozenDate when present', async () => {
    const frozenRaw = { ...mockRaw, frozenDate: '2026-03-01T00:00:00.000Z' }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => frozenRaw } as Response)
    const result = await apiFetchPantryItem(1)
    expect(result!.frozenDate).toBeInstanceOf(Date)
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
  it('posts item data and parses dates in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRaw } as Response)
    const result = await apiCreatePantryItem({
      foodId: 1,
      originalSizeAmount: 16,
      originalSizeUnit: 'oz',
      currentSizeAmount: 8,
      currentSizeUnit: 'oz',
    })
    expect(result.expirationDate).toBeInstanceOf(Date)
    expect(result.addedDate).toBeInstanceOf(Date)
    expect(fetch).toHaveBeenCalledWith('/api/pantry', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)
    await expect(apiCreatePantryItem({ foodId: 1, originalSizeAmount: 1, currentSizeAmount: 1 })).rejects.toThrow('Failed to create pantry item')
  })
})

describe('apiUpdatePantryItem', () => {
  it('puts item data and parses dates in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRaw } as Response)
    const result = await apiUpdatePantryItem(1, { currentSizeAmount: 4 })
    expect(result.expirationDate).toBeInstanceOf(Date)
    expect(result.addedDate).toBeInstanceOf(Date)
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('sends frozenDate in update payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRaw } as Response)
    await apiUpdatePantryItem(1, { frozenDate: '2026-05-01T00:00:00.000Z' })
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.frozenDate).toBe('2026-05-01T00:00:00.000Z')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiUpdatePantryItem(1, {})).rejects.toThrow('Failed to update pantry item')
  })
})

describe('apiDeletePantryItem', () => {
  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeletePantryItem(1)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/pantry/1', { method: 'DELETE' })
  })

  it('accepts 204 as success even when ok is false', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 204 } as Response)
    await expect(apiDeletePantryItem(1)).resolves.toBeUndefined()
  })

  it('throws on non-204 error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiDeletePantryItem(1)).rejects.toThrow('Failed to delete pantry item')
  })
})
