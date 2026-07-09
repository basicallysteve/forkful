import { convertUnit, getUnitCategory } from './unitConversion'
import { round2 } from './number'
import type { Measurement } from '@/types/Food'

// A single matching Pantry stock entry for an ingredient: the current amount in the Pantry Item's own
// unit, plus the calibration data (density, Measurements) needed to bridge that unit to the ingredient's.
export type PantryGapStock = {
  amount: number
  unit: string
  density?: number
  measurements: Measurement[]
}

// The Recipe Ingredient a gap is computed for: the required quantity in its unit, plus the same
// calibration data used when a Custom Unit sits on either side of the conversion.
export type PantryGapIngredient = {
  requiredQuantity: number
  unit: string
  density?: number
  measurements: Measurement[]
}

// A stock level a hair under the requirement from numeric(10,2) / float rounding shouldn't add a
// sub-cent line, so treat a shortfall within half a cent of zero as fully stocked.
const SHORTFALL_EPSILON = 0.005

// Convert a quantity of Pantry stock (in the Pantry Item's unit) into the ingredient's unit — the same
// bridging Meal Preparation Deduction applies, just in the opposite direction. Returns null when the
// two units can't be bridged: an unconvertible pair, or an Uncalibrated Custom Unit on either side.
function convertStockToIngredientUnit(stock: PantryGapStock, ingredient: PantryGapIngredient): number | null {
  const fromUnit = stock.unit
  const toUnit = ingredient.unit
  // Same unit (including the same Custom Unit, e.g. both "slice") is a direct comparison.
  if (fromUnit === toUnit) return stock.amount

  const fromCat = getUnitCategory(fromUnit)
  const toCat = getUnitCategory(toUnit)
  // Matched stock is the same substance as the ingredient, so a single density bridges any mass↔volume
  // step; prefer the Pantry source's density and fall back to the ingredient Food's.
  const density = stock.density ?? ingredient.density

  if (fromCat !== 'custom' && toCat !== 'custom') {
    return convertUnit({ value: stock.amount, fromUnit, toUnit, density })
  }

  if (fromCat === 'custom' && toCat !== 'custom') {
    // Pantry unit is custom — need its gram-weight to reach the ingredient's standard unit.
    const gramsPerUnit = stock.measurements.find((m) => m.unit === fromUnit)?.gramsPerUnit
    if (!gramsPerUnit) return null
    return convertUnit({ value: stock.amount * gramsPerUnit, fromUnit: 'g', toUnit, density })
  }

  if (fromCat !== 'custom' && toCat === 'custom') {
    // Ingredient unit is custom — convert the Pantry stock to grams, then to the ingredient's count.
    const gramsPerUnit = ingredient.measurements.find((m) => m.unit === toUnit)?.gramsPerUnit
    if (!gramsPerUnit) return null
    const grams = convertUnit({ value: stock.amount, fromUnit, toUnit: 'g', density })
    if (grams === null) return null
    return grams / gramsPerUnit
  }

  // Both custom and not the same unit — food-specific Custom Units are not mutually convertible.
  return null
}

// The shortfall to add to the Shopping List for one ingredient, expressed in the ingredient's unit — or
// null when the ingredient is already fully stocked and should be skipped. Matching Pantry stock is
// summed after converting each entry into the ingredient's unit, and the shortfall is the required
// quantity minus that sum. When any matching entry can't be converted (an Uncalibrated Custom Unit or an
// unconvertible pair) the amount on hand can't be known precisely, so we fall back to the full required
// quantity rather than under-buying — matching the Pantry-Gap Fill contract in CONTEXT.md.
export function computePantryGapShortfall(
  ingredient: PantryGapIngredient,
  stock: PantryGapStock[],
): number | null {
  const required = ingredient.requiredQuantity

  let available = 0
  for (const entry of stock) {
    const converted = convertStockToIngredientUnit(entry, ingredient)
    // Can't account for this ingredient's stock precisely — buy the whole required quantity to be safe.
    if (converted === null) return round2(required)
    available += converted
  }

  const shortfall = required - available
  if (shortfall <= SHORTFALL_EPSILON) return null
  return round2(shortfall)
}
