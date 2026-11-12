import type { PantryItem } from '@/types/PantryItem'

// The name shown for a Pantry Item: a Prepared Meal uses its recipe-name snapshot (the recipe may have
// been deleted since), anything else uses its Food or Product name.
export function itemDisplayName(item: PantryItem): string {
  if (item.sourceType === 'recipe') return item.recipeNameSnapshot ?? 'Prepared Meal'
  return item.food?.name ?? item.product?.name ?? 'item'
}
