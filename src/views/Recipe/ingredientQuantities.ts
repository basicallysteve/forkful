import type { Ingredient } from '@/types/Ingredient'

// A stored row with invalid or zero quantity text has quantity 0; such a recipe must not be saved.
export function hasValidQuantities(ingredients: Ingredient[] | undefined): boolean {
  return (ingredients ?? []).every((ingredient) => ingredient.quantity > 0)
}
