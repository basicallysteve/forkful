import type { Food } from './Food'
import type { Product } from './Product'

export type ShoppingListStatus = 'active' | 'archived'
export type ShoppingListItemSourceType = 'food' | 'product' | 'freeform'
export type ShoppingListItemStatus = 'to_buy' | 'bought' | 'unavailable'

export type ShoppingList = {
  id: number
  userId: number
  status: ShoppingListStatus
  dateAdded: Date
}

export type ShoppingListItem = {
  id: number
  sourceType: ShoppingListItemSourceType
  status: ShoppingListItemStatus
  // Display name for the line, always populated: the linked Food/Product name, or the freeform text.
  name: string
  // Present only for the matching sourceType; freeform lines have neither.
  food?: Food
  product?: Product
  amount: number
  // Null for freeform lines that omit a unit.
  unit: string | null
  // Total paid for the whole line (not per-unit), in the app's single currency. Null until recorded.
  // Per-unit cost is derived as linePrice / amount when needed.
  linePrice: number | null
  // Optionally recorded at check-off; transfers to the Pantry Item on Trip Completion. Null when absent.
  expirationDate: Date | null
  addedDate: Date
}

// The outcome of a Shopping Trip Completion, shared by the data layer (which produces it) and the API
// client (which parses it): how many Pantry Items were created, how the still-unbought lines were
// handled (kept onto a fresh active list, or dropped with the archive), and the new active list's
// contents afterwards — the kept lines when keeping, otherwise empty.
export type ShoppingTripCompletion = {
  pantryItemsCreated: number
  keptCount: number
  droppedCount: number
  items: ShoppingListItem[]
}
