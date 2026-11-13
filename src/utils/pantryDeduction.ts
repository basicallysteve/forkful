import type { Measurement } from '@/types/Food'
import { convertFoodAmount } from '@/utils/convertFoodAmount'

export type PantryDeductionInput = {
  ingredientQuantity: number
  ingredientUnit: string
  ingredientMeasurements: Measurement[]
  pantryAmount: number
  pantryUnit: string
  pantryMeasurements: Measurement[]
  /** The Density that bridges mass and volume: the pantry source's, else the ingredient Food's. */
  density?: number
}

export type PantryDeductionSuggestion = {
  canAutoConvert: boolean
  suggestedDeductAmount: number | null
}

/**
 * Convert between a unit on one side (an ingredient Food) and a unit on the other (a pantry Food or
 * Product), resolving each side's Custom Units with that side's own calibration (ADR-0028): `from` is
 * taken to grams or ml with `fromMeasurements`, then on to `to` with `toMeasurements`. Returns null when
 * a step is unresolvable (uncalibrated unit, or mass<->volume without Density). Pure and framework-free.
 */
export function convertAcrossSides(
  amount: number,
  from: string,
  fromMeasurements: Measurement[],
  to: string,
  toMeasurements: Measurement[],
  density?: number,
): number | null {
  const fromFood = { measurements: fromMeasurements, density }
  const toFood = { measurements: toMeasurements, density }
  // Same unit with no calibration involved needs no bridge, but a calibrated unit may differ per side.
  for (const base of ['g', 'ml']) {
    const inBase = convertFoodAmount(fromFood, amount, from, base)
    if (inBase === null) continue
    const result = convertFoodAmount(toFood, inBase, base, to)
    if (result !== null) return result
  }
  return from === to ? amount : null
}

/**
 * How much stock (in the Pantry Item's unit) a recipe ingredient uses, capped at what is on hand.
 * Anything unresolvable returns `canAutoConvert: false` so the User enters the amount by hand.
 */
export function suggestPantryDeduction(input: PantryDeductionInput): PantryDeductionSuggestion {
  const converted = convertAcrossSides(
    input.ingredientQuantity,
    input.ingredientUnit,
    input.ingredientMeasurements,
    input.pantryUnit,
    input.pantryMeasurements,
    input.density,
  )
  if (converted === null) return { canAutoConvert: false, suggestedDeductAmount: null }
  return { canAutoConvert: true, suggestedDeductAmount: Math.min(converted, input.pantryAmount) }
}
