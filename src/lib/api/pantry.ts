import { apiFetch, ensureOk } from './errors'
import type { PantryItem } from '@/types/PantryItem'
import type { PantryQueryOptions, IngredientMatch, PantryMatchOption, PreparedMealDeduction } from '@/lib/pantry'

type RawPantryItem = Omit<PantryItem, 'expirationDate' | 'addedDate' | 'frozenDate'> & {
  expirationDate: string | null
  addedDate: string
  frozenDate: string | null
}

function parsePantryItem(raw: RawPantryItem): PantryItem {
  return {
    ...raw,
    expirationDate: raw.expirationDate ? new Date(raw.expirationDate) : null,
    addedDate: new Date(raw.addedDate),
    frozenDate: raw.frozenDate ? new Date(raw.frozenDate) : null,
  }
}

export type CreatePantryItemData = {
  sourceType?: 'food' | 'product'
  foodId?: number
  productId?: number
  expirationDate?: string | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

export type UpdatePantryItemData = Partial<Omit<CreatePantryItemData, 'foodId'>> & {
  frozenDate?: string | null
}

export async function apiFetchPantryItems(options: PantryQueryOptions = {}): Promise<PantryItem[]> {
  const params = new URLSearchParams()
  if (options.search) params.set('search', options.search)
  if (options.status && options.status !== 'all') params.set('status', options.status)
  if (options.sortBy) params.set('sortBy', options.sortBy)
  if (options.sortDir) params.set('sortDir', options.sortDir)
  const query = params.toString()
  const res = await apiFetch(`/api/pantry${query ? `?${query}` : ''}`)
  await ensureOk(res, 'Failed to fetch pantry items')
  const raw: RawPantryItem[] = await res.json()
  return raw.map(parsePantryItem)
}

export async function apiFetchPantryItem(id: number): Promise<PantryItem | null> {
  const res = await apiFetch(`/api/pantry/${id}`)
  if (res.status === 404) return null
  await ensureOk(res, 'Failed to fetch pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

export async function apiCreatePantryItem(data: CreatePantryItemData): Promise<PantryItem> {
  const res = await apiFetch('/api/pantry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to create pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

export async function apiUpdatePantryItem(id: number, data: UpdatePantryItemData): Promise<PantryItem> {
  const res = await apiFetch(`/api/pantry/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to update pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

// keepalive lets a delete finish even if the page is reloaded or closed while it is in flight.
export async function apiDeletePantryItem(id: number): Promise<void> {
  const res = await apiFetch(`/api/pantry/${id}`, { method: 'DELETE', keepalive: true })
  await ensureOk(res, 'Failed to delete pantry item', [204])
}

export async function apiDeletePantryItems(ids: number[]): Promise<number[]> {
  const res = await apiFetch('/api/pantry', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    keepalive: true,
  })
  await ensureOk(res, 'Failed to delete pantry items')
  const result = await res.json()
  return result.deletedIds
}

export async function apiFetchIngredientPantryMatches(recipeShortId: string): Promise<IngredientMatch[]> {
  const res = await apiFetch(`/api/pantry/prepare?recipeShortId=${encodeURIComponent(recipeShortId)}`)
  await ensureOk(res, 'Failed to fetch ingredient pantry matches')
  const raw: (Omit<IngredientMatch, 'pantryMatches'> & {
    pantryMatches: (Omit<PantryMatchOption, 'expirationDate'> & { expirationDate: string | null })[]
  })[] = await res.json()
  return raw.map(ing => ({
    ...ing,
    pantryMatches: ing.pantryMatches.map(m => ({
      ...m,
      expirationDate: m.expirationDate ? new Date(m.expirationDate) : null,
    })),
  }))
}

export type PrepareMealData = {
  recipeShortId: string
  servings: number
  expirationDate?: string | null
  skipDeduction: boolean
  deductions: PreparedMealDeduction[]
}

export async function apiPrepareMeal(data: PrepareMealData): Promise<PantryItem> {
  const res = await apiFetch('/api/pantry/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to create prepared meal')
  const raw = await res.json()
  return {
    ...raw,
    expirationDate: raw.expirationDate ? new Date(raw.expirationDate) : null,
    addedDate: new Date(raw.addedDate),
    frozenDate: raw.frozenDate ? new Date(raw.frozenDate) : null,
  }
}
