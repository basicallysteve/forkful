import { formatUnitForAmount } from '@/utils/unitConversion'
import type { ShoppingListItem } from '@/types/ShoppingList'

// The quantity label for a Shopping List line, shared by the active list and the archived (history)
// views so they read identically. Amount only shows when it carries meaning: with a unit, or when it
// isn't a bare "1".
export function itemQuantityLabel(item: Pick<ShoppingListItem, 'amount' | 'unit'>): string {
  if (item.unit) return `${item.amount} ${formatUnitForAmount(item.amount, item.unit)}`
  return item.amount === 1 ? '' : `${item.amount}`
}
