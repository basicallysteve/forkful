import type { Food } from './Food'

export type PantryItemStatus = 'expired' | 'expiring-soon' | 'good'

export type PantryItem = {
  id: number
  food: Food
  expirationDate: Date | null
  quantity: number
  quantityLeft: number
  originalSize: number
  currentSize: number
  addedDate: Date
  status: PantryItemStatus
}
