import type { PantryItem } from '@/types/PantryItem'

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
  foodId: number
  expirationDate?: string | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

export type UpdatePantryItemData = Partial<Omit<CreatePantryItemData, 'foodId'>> & {
  frozenDate?: string | null
}

export async function apiFetchPantryItems(): Promise<PantryItem[]> {
  const res = await fetch('/api/pantry')
  if (!res.ok) throw new Error('Failed to fetch pantry items')
  const raw: RawPantryItem[] = await res.json()
  return raw.map(parsePantryItem)
}

export async function apiFetchPantryItem(id: number): Promise<PantryItem | null> {
  const res = await fetch(`/api/pantry/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

export async function apiCreatePantryItem(data: CreatePantryItemData): Promise<PantryItem> {
  const res = await fetch('/api/pantry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

export async function apiUpdatePantryItem(id: number, data: UpdatePantryItemData): Promise<PantryItem> {
  const res = await fetch(`/api/pantry/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update pantry item')
  const raw: RawPantryItem = await res.json()
  return parsePantryItem(raw)
}

export async function apiDeletePantryItem(id: number): Promise<void> {
  const res = await fetch(`/api/pantry/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete pantry item')
}
