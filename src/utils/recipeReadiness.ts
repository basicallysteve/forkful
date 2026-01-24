import type { Recipe } from '@/types/Recipe'
import type { PantryItem } from '@/types/PantryItem'
import type { Ingredient } from '@/types/Ingredient'
import { convertUnit, canConvert } from './unitConversion'

export type IngredientAvailability = {
  ingredient: Ingredient
  available: number // Quantity available in the same unit as ingredient
  needed: number // Quantity needed (from recipe)
  unit: string // Unit for both available and needed
  isSufficient: boolean
  shortage: number // How much is missing (0 if sufficient)
  frozenQuantity: number // How much of the available quantity is frozen
  needsThawing: boolean // Whether user needs to thaw frozen items
}

export type RecipeReadiness = {
  recipeId: number
  totalIngredients: number
  availableIngredients: number // Count of ingredients that have sufficient quantity
  partialIngredients: number // Count of ingredients with some but not enough
  missingIngredients: number // Count of ingredients with none available
  readinessScore: number // 0-100 percentage
  ingredientDetails: IngredientAvailability[]
}

/**
 * Calculates the availability of a single ingredient based on pantry items
 */
export function calculateIngredientAvailability(
  ingredient: Ingredient,
  pantryItems: PantryItem[]
): IngredientAvailability {
  const needed = ingredient.quantity
  const unit = ingredient.servingUnit

  // Find all pantry items matching this ingredient's food
  // Note: This filters out expired items (status === 'expired')
  const matchingItems = pantryItems.filter(
    (item) => item.food.id === ingredient.food.id && item.status !== 'expired'
  )

  if (matchingItems.length === 0) {
    return {
      ingredient,
      available: 0,
      needed,
      unit,
      isSufficient: false,
      shortage: needed,
      frozenQuantity: 0,
      needsThawing: false,
    }
  }

  // Sum up available quantity from all matching pantry items
  let totalAvailable = 0
  let totalFrozen = 0
  for (const item of matchingItems) {
    const itemQuantity = item.currentSize.size
    const itemUnit = item.currentSize.unit || ingredient.food.servingUnit || 'g'

    // Try to convert pantry item quantity to ingredient's unit
    let convertedQuantity = 0
    if (itemUnit === unit) {
      convertedQuantity = itemQuantity
    } else if (canConvert(itemUnit, unit)) {
      const converted = convertUnit(itemQuantity, itemUnit, unit)
      if (converted !== null) {
        convertedQuantity = converted
      }
    }
    // If units are incompatible, we can't count this pantry item
    
    if (convertedQuantity > 0) {
      totalAvailable += convertedQuantity
      // Track if this item is frozen
      if (item.frozenDate !== null) {
        totalFrozen += convertedQuantity
      }
    }
  }

  const isSufficient = totalAvailable >= needed
  const shortage = Math.max(0, needed - totalAvailable)
  const needsThawing = totalFrozen > 0 && !isSufficient

  return {
    ingredient,
    available: totalAvailable,
    needed,
    unit,
    isSufficient,
    shortage,
    frozenQuantity: totalFrozen,
    needsThawing,
  }
}

/**
 * Calculates the overall readiness of a recipe based on available pantry items
 */
export function calculateRecipeReadiness(
  recipe: Recipe,
  pantryItems: PantryItem[]
): RecipeReadiness {
  const ingredientDetails = recipe.ingredients.map((ingredient) =>
    calculateIngredientAvailability(ingredient, pantryItems)
  )

  const totalIngredients = ingredientDetails.length
  const availableIngredients = ingredientDetails.filter((detail) => detail.isSufficient).length
  const missingIngredients = ingredientDetails.filter((detail) => detail.available === 0).length
  const partialIngredients = ingredientDetails.filter(
    (detail) => detail.available > 0 && !detail.isSufficient
  ).length

  // Calculate readiness score as a percentage
  // Give full credit for sufficient ingredients, partial credit for partial availability
  const score = totalIngredients === 0 
    ? 0 
    : ((availableIngredients + partialIngredients * 0.5) / totalIngredients) * 100

  return {
    recipeId: recipe.id,
    totalIngredients,
    availableIngredients,
    partialIngredients,
    missingIngredients,
    readinessScore: Math.round(score),
    ingredientDetails,
  }
}

/**
 * Calculate readiness for multiple recipes
 */
export function calculateRecipesReadiness(
  recipes: Recipe[],
  pantryItems: PantryItem[]
): Map<number, RecipeReadiness> {
  const readinessMap = new Map<number, RecipeReadiness>()
  
  for (const recipe of recipes) {
    const readiness = calculateRecipeReadiness(recipe, pantryItems)
    readinessMap.set(recipe.id, readiness)
  }
  
  return readinessMap
}
