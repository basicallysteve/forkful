import type { Food } from './Food'
import type { Product } from './Product'

export type PantryItemStatus = 'expired' | 'expiring-soon' | 'good'

type ServingSize = {
  size: number
  unit?: string
}

export type PantryItem = {
  id: number
  sourceType: 'food' | 'product' | 'recipe'
  food?: Food       // set when sourceType === 'food'
  product?: Product // set when sourceType === 'product'
  recipeId?: number | null            // set when sourceType === 'recipe'
  recipeNameSnapshot?: string | null  // set when sourceType === 'recipe'
  recipeShortId?: string | null       // non-null when the recipe still exists (not deleted)
  shoppingListItemId?: number | null   // provenance: the Shopping List Item this came from, if any
  // Purchase price read *through* the shoppingListItemId FK (the source line's Line Price) — never a
  // column on pantry_items. Null when the item wasn't bought on a trip, or the trip recorded no price.
  purchasePrice?: number | null
  expirationDate: Date | null
  originalSize: ServingSize
  currentSize: ServingSize
  addedDate: Date
  status: PantryItemStatus
  frozenDate: Date | null
}
