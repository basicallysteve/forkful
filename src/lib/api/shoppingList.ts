import type { ShoppingListItem, ShoppingListItemStatus } from '@/types/ShoppingList'

type RawShoppingListItem = Omit<ShoppingListItem, 'addedDate'> & {
  addedDate: string
}

function parseShoppingListItem(raw: RawShoppingListItem): ShoppingListItem {
  return {
    ...raw,
    addedDate: new Date(raw.addedDate),
  }
}

// One create payload, discriminated by sourceType — mirrors the single POST /api/shopping-list
// endpoint, which branches on the same field.
export type CreateShoppingListItemInput =
  | { sourceType: 'food'; foodId: number; amount: number; unit: string }
  | { sourceType: 'product'; productId: number; amount: number; unit: string }
  | { sourceType: 'freeform'; name: string; amount: number; unit?: string | null }

export async function apiFetchShoppingListItems(): Promise<ShoppingListItem[]> {
  const res = await fetch('/api/shopping-list')
  if (!res.ok) throw new Error('Failed to fetch shopping list items')
  const raw: RawShoppingListItem[] = await res.json()
  return raw.map(parseShoppingListItem)
}

export async function apiCreateShoppingListItem(input: CreateShoppingListItemInput): Promise<ShoppingListItem> {
  const res = await fetch('/api/shopping-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) throw new Error('Failed to create shopping list item')
  const raw: RawShoppingListItem = await res.json()
  return parseShoppingListItem(raw)
}

export async function apiDeleteShoppingListItem(id: number): Promise<void> {
  const res = await fetch(`/api/shopping-list/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete shopping list item')
}

export async function apiUpdateShoppingListItemStatus(
  id: number,
  status: ShoppingListItemStatus,
): Promise<ShoppingListItem> {
  const res = await fetch(`/api/shopping-list/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) throw new Error('Failed to update shopping list item status')
  const raw: RawShoppingListItem = await res.json()
  return parseShoppingListItem(raw)
}
