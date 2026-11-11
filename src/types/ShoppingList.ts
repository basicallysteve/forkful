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

// The outcome of a Scan-to-Buy (ADR-0021), shared by the data layer (which produces it) and the API
// client (which parses it): 'upgraded' (a planned Food line promoted to the scanned Product), 'checked'
// (a planned Product line marked bought), or 'impulse' (a fresh bought Product line for an off-list scan).
export type ScanToBuyOutcome = 'upgraded' | 'checked' | 'impulse'

export type ScanToBuyResult = {
  item: ShoppingListItem
  outcome: ScanToBuyOutcome
}

// One row in the archived-lists index (the price-history browse view). A completed Shopping List is
// retained for price history; the index summarises it by how many lines were bought and how much was
// spent (the sum of the bought lines' Line Prices, an unpriced line contributing 0), plus the list's
// date. `dateAdded` is when the list was started — the app stores no separate completion timestamp.
export type ArchivedShoppingListSummary = {
  id: number
  dateAdded: Date
  boughtItemCount: number
  // How many bought lines recorded a Line Price. Distinguishes "no prices recorded" from a trip whose
  // prices legitimately sum to $0.00 (a free/comped line is allowed) — the index keys its price display
  // off this, not off `totalSpent > 0`.
  pricedItemCount: number
  totalSpent: number
}

// A single archived Shopping List opened from the index: the lines that were actually bought, each
// carrying its Line Price, plus the total spent across them. Only bought lines are surfaced — an
// archive's price history is what was purchased, not what was left unbought when the trip ended.
export type ArchivedShoppingList = {
  id: number
  dateAdded: Date
  items: ShoppingListItem[]
  totalSpent: number
}
