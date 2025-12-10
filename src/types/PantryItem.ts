import type { Food } from './Food'

export type PantryItemStatus = 'expired' | 'expiring-soon' | 'good'

type ServingSize = {
  size: number
  unit?: string
  breaksInto?: ServingSize
}


export type PantryItem = {
  id: number
  food: Food
  expirationDate: Date | null
  quantity: number
  quantityLeft: number
  originalSize: ServingSize
  currentSize: ServingSize
  addedDate: Date
  status: PantryItemStatus
}
