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

// A single portion of a split: a share of the line's amount plus its own expiration date.
export type ShoppingListItemPortionInput = {
  amount: number
  expirationDate: Date | null
}

// Split one line into several, each carrying a share of the amount and its own expiration date (the
// "different dates per item" path). The portions must sum to the line's amount. An optional linePrice
// (the whole-line total) is distributed across the portions server-side. Returns every resulting line.
export async function apiSplitShoppingListItem(
  id: number,
  input: { portions: ShoppingListItemPortionInput[]; linePrice?: number | null },
): Promise<ShoppingListItem[]> {
  const body: { portions: { amount: number; expirationDate: string | null }[]; linePrice?: number | null } = {
    portions: input.portions.map((portion) => ({
      amount: portion.amount,
      expirationDate: portion.expirationDate ? portion.expirationDate.toISOString() : null,
    })),
  }
  if ('linePrice' in input) body.linePrice = input.linePrice

  const res = await fetch(`/api/shopping-list/${id}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error('Failed to split shopping list item')
  const raw: RawShoppingListItem[] = await res.json()
  return raw.map(parseShoppingListItem)
}

// What the server reports after finishing a shopping trip: how many Pantry Items were created, how the
// leftover lines were handled, and the new active list's items (the kept lines, or empty when dropped).
export type CompleteShoppingTripResult = {
  pantryItemsCreated: number
  keptCount: number
  droppedCount: number
  items: ShoppingListItem[]
}

// Finish the shopping trip: archive the active list, transfer bought Food/Product lines to the Pantry,
// and keep or drop the still-unbought lines as one batch. `keepUnbought` answers the leftover prompt.
export async function apiCompleteShoppingTrip(keepUnbought: boolean): Promise<CompleteShoppingTripResult> {
  const res = await fetch('/api/shopping-list/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepUnbought }),
  })

  if (!res.ok) throw new Error('Failed to complete shopping trip')
  const raw: Omit<CompleteShoppingTripResult, 'items'> & { items: RawShoppingListItem[] } = await res.json()
  return { ...raw, items: raw.items.map(parseShoppingListItem) }
}
