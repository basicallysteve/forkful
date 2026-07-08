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
  addedDate: Date
}
