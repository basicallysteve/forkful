import type { Measurement } from '@/types/Food'
import { convertFoodAmount } from '@/utils/convertFoodAmount'

export type PantryDeductionInput = {
  ingredientQuantity: number
  ingredientUnit: string
  ingredientMeasurements: Measurement[]
  pantryAmount: number
  pantryUnit: string
  pantryMeasurements: Measurement[]
  /** The pantry source's Density; falls back to the ingredient Food's. */
  density?: number
  ingredientDensity?: number
}

export type PantryDeductionSuggestion = {
  canAutoConvert: boolean
  suggestedDeductAmount: number | null
}

/**
 * How much stock (in the Pantry Item's unit) a recipe ingredient uses, capped at what is on hand.
 * Converts through `convertFoodAmount`, so Calibrated Custom Units on either side resolve to grams or ml
 * (ADR-0028). Anything unresolvable returns `canAutoConvert: false` so the User enters the amount by hand.
 * Pure and framework-free.
 */
export function suggestPantryDeduction(input: PantryDeductionInput): PantryDeductionSuggestion {
  const converted = convertFoodAmount(
    {
      measurements: [...input.ingredientMeasurements, ...input.pantryMeasurements],
      density: input.density ?? input.ingredientDensity,
    },
    input.ingredientQuantity,
    input.ingredientUnit,
    input.pantryUnit,
  )
  if (converted === null) return { canAutoConvert: false, suggestedDeductAmount: null }
  return { canAutoConvert: true, suggestedDeductAmount: Math.min(converted, input.pantryAmount) }
}
