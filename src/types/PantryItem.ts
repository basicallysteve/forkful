import type { Food } from './Food'
import type { Product } from './Product'

export type PantryItemStatus = 'expired' | 'expiring-soon' | 'good'

type ServingSize = {
  size: number
  unit?: string
}

export type PantryItem = {
  id: number
  sourceType: 'food' | 'product'
  food?: Food       // set when sourceType === 'food'
  product?: Product // set when sourceType === 'product'
  expirationDate: Date | null
  originalSize: ServingSize
  currentSize: ServingSize
  addedDate: Date
  status: PantryItemStatus
  frozenDate: Date | null
}
