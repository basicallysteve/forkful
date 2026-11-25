import type { Food } from '@/types/Food'
import type { Macros } from '@/types/FoodLogEntry'
import { convertFoodAmount } from '@/utils/convertFoodAmount'

/**
 * Anything Food-shaped: stored macros per serving, the serving anchor, and the calibrations that let
 * other units reach it (Measurements and Density). Foods and Products both fit (ADR-0028).
 */
export type NutritionSource = Pick<
  Food,
  'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'servingSize' | 'servingUnit' | 'measurements' | 'density'
>

// How many serving-anchor servings `amount` of `unit` represents, or null when it can't be resolved.
function servingsFor(
  source: Pick<Food, 'servingSize' | 'servingUnit' | 'measurements' | 'density'>,
  amount: number,
  unit: string,
): number | null {
  if (!(source.servingSize > 0)) return null
  const inServingUnit = convertFoodAmount(source, amount, unit, source.servingUnit)
  return inServingUnit === null ? null : inServingUnit / source.servingSize
}

/**
 * The five macros for `amount` of `unit` of a Food-shaped source, at full precision (callers that
 * persist round them). Null when the unit can't be resolved to the serving unit. The one scaling
 * implementation shared by ingredients, the food log and the client; framework-free for the iOS port
 * (ADR-0028, ADR-0002, ADR-0025).
 */
export function macrosFor(source: NutritionSource, amount: number, unit: string): Macros | null {
  const factor = servingsFor(source, amount, unit)
  if (factor === null) return null
  return {
    calories: source.calories * factor,
    protein: source.protein * factor,
    carbs: source.carbs * factor,
    fat: source.fat * factor,
    fiber: source.fiber * factor,
  }
}

/** Calories for `amount` of `unit`, or null when the unit can't be resolved. */
export function caloriesFor(source: NutritionSource, amount: number, unit: string): number | null {
  return macrosFor(source, amount, unit)?.calories ?? null
}

// Whether logging `unit` for this Food can resolve to its base serving unit. False means the unit has
// no weight (or volume) for this Food, so frozen macros would compute to zero (ADR-0025, ADR-0028).
export function unitResolvesForFood(
  food: Pick<Food, 'measurements' | 'servingUnit' | 'servingSize' | 'density'>,
  unit: string,
): boolean {
  if (!unit) return true
  return servingsFor(food, 1, unit) !== null
}

/**
 * Whether a recipe's Nutrition Complete flag holds: every ingredient with a quantity resolves to
 * calories above zero from its own Food row. Client-sent calories are never consulted (ADR-0002); a
 * missing Food row counts as incomplete.
 */
export function isNutritionComplete(
  items: { foodId: number; quantity: number; servingUnit: string }[],
  foodsById: Map<number, NutritionSource>,
): boolean {
  return items.every((item) => {
    if (item.quantity === 0) return true
    const food = foodsById.get(item.foodId)
    if (!food) return false
    return (caloriesFor(food, item.quantity, item.servingUnit) ?? 0) > 0
  })
}
