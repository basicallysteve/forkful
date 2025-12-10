import type { Food } from './Food'

export type PantryItemStatus = 'expired' | 'expiring-soon' | 'good'

export type PantryItem = {
  id: number
  food: Food
  expirationDate: Date
  quantity: number
  addedDate: Date
  status?: PantryItemStatus
}
