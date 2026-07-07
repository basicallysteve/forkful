import type { Food } from './Food'

export type ShoppingListStatus = 'active' | 'archived'
export type ShoppingListItemSourceType = 'food' | 'product' | 'freeform'
export type ShoppingListItemStatus = 'to_buy' | 'in_cart' | 'purchased'

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
  food: Food
  amount: number
  unit: string
  addedDate: Date
}
