import type { ShoppingListItem, ShoppingListItemStatus } from '@/types/ShoppingList'

type RawShoppingListItem = Omit<ShoppingListItem, 'addedDate' | 'expirationDate'> & {
  addedDate: string
  // Serialized over the wire as an ISO string (or null when unset).
  expirationDate?: string | null
}

function parseShoppingListItem(raw: RawShoppingListItem): ShoppingListItem {
  return {
    ...raw,
    expirationDate: raw.expirationDate ? new Date(raw.expirationDate) : null,
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

// Persists a status change. Resolves on success and throws on failure — the caller keeps its own
// (optimistic) copy of the line, since only `status` changes server-side, so no response body is read.
export async function apiUpdateShoppingListItemStatus(
  id: number,
  status: ShoppingListItemStatus,
): Promise<void> {
  const res = await fetch(`/api/shopping-list/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) throw new Error('Failed to update shopping list item status')
}

// The optional check-off details: the Line Price total and the expiration date. Each field is
// independent — omit a key to leave it unchanged, or pass null to clear it. Only the whole-line total
// is sent (the per-unit ↔ total conversion happens in the entry UI). Returns the re-joined line so the
// caller can replace its store copy with the persisted (rounded) price.
export type UpdateShoppingListItemDetailsInput = {
  linePrice?: number | null
  expirationDate?: Date | null
}

export async function apiUpdateShoppingListItemDetails(
  id: number,
  input: UpdateShoppingListItemDetailsInput,
): Promise<ShoppingListItem> {
  const body: { linePrice?: number | null; expirationDate?: string | null } = {}
  if ('linePrice' in input) body.linePrice = input.linePrice
  // Serialize the Date to an ISO string; null clears it, undefined leaves it unchanged.
  if ('expirationDate' in input) body.expirationDate = input.expirationDate ? input.expirationDate.toISOString() : null

  const res = await fetch(`/api/shopping-list/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error('Failed to update shopping list item details')
  const raw: RawShoppingListItem = await res.json()
  return parseShoppingListItem(raw)
}
