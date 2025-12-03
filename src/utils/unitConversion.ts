// Define unit categories
export type UnitCategory = 'mass' | 'volume' | 'custom'

// Mass units supported for food
export const MASS_UNITS = ['g', 'kg', 'oz', 'lb', 'mg'] as const
export type MassUnit = typeof MASS_UNITS[number]

// Volume units supported for food
export const VOLUME_UNITS = ['ml', 'l', 'cup', 'Tbs', 'tsp', 'fl-oz'] as const
export type VolumeUnit = typeof VOLUME_UNITS[number]

// Common custom units (not convertible)
export const CUSTOM_UNITS = ['slice', 'piece', 'serving', 'portion', 'loaf', 'can', 'bottle', 'package'] as const
export type CustomUnit = typeof CUSTOM_UNITS[number]

export type FoodUnit = MassUnit | VolumeUnit | CustomUnit

// Conversion factors to base units (g for mass, ml for volume)
const MASS_TO_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
}

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  Tbs: 14.7868,
  'fl-oz': 29.5735,
  cup: 236.588,
}

/**
 * Determines the category of a unit
 */
export function getUnitCategory(unit: string): UnitCategory {
  if (MASS_UNITS.includes(unit as MassUnit)) return 'mass'
  if (VOLUME_UNITS.includes(unit as VolumeUnit)) return 'volume'
  return 'custom'
}

/**
 * Returns the allowed units based on the base serving unit category
 */
export function getAllowedUnits(baseUnit: string): string[] {
  const category = getUnitCategory(baseUnit)
  
  if (category === 'mass') {
    return [...MASS_UNITS]
  }
  if (category === 'volume') {
    return [...VOLUME_UNITS]
  }
  // For custom units, allow same custom unit plus common custom units
  return [baseUnit, ...CUSTOM_UNITS.filter(u => u !== baseUnit)]
}

/**
 * Checks if a unit can be converted to another
 */
export function canConvert(fromUnit: string, toUnit: string): boolean {
  const fromCategory = getUnitCategory(fromUnit)
  const toCategory = getUnitCategory(toUnit)
  
  // Can only convert within the same category (mass to mass, volume to volume)
  // Custom units cannot be converted
  return fromCategory === toCategory && fromCategory !== 'custom'
}

/**
 * Converts a value from one unit to another
 * Returns null if conversion is not possible
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
  if (!canConvert(fromUnit, toUnit)) {
    return null
  }
  
  const fromCategory = getUnitCategory(fromUnit)
  
  if (fromCategory === 'mass') {
    const fromFactor = MASS_TO_GRAMS[fromUnit]
    const toFactor = MASS_TO_GRAMS[toUnit]
    if (fromFactor === undefined || toFactor === undefined) return null
    return (value * fromFactor) / toFactor
  }
  
  if (fromCategory === 'volume') {
    const fromFactor = VOLUME_TO_ML[fromUnit]
    const toFactor = VOLUME_TO_ML[toUnit]
    if (fromFactor === undefined || toFactor === undefined) return null
    return (value * fromFactor) / toFactor
  }
  
  return null
}

/**
 * Calculates calories for a given amount and unit based on food's per-serving calories
 * @param baseCalories - Calories per serving
 * @param baseServingSize - The base serving size amount
 * @param baseServingUnit - The base serving unit
 * @param targetAmount - The amount we want calories for
 * @param targetUnit - The unit of the target amount
 * @returns Calculated calories or null if conversion not possible
 */
export function calculateCalories(
  baseCalories: number,
  baseServingSize: number,
  baseServingUnit: string,
  targetAmount: number,
  targetUnit: string
): number | null {
  // Same unit - simple ratio calculation
  if (baseServingUnit === targetUnit) {
    return (baseCalories / baseServingSize) * targetAmount
  }
  
  // Try to convert target to base unit
  const convertedAmount = convertUnit(targetAmount, targetUnit, baseServingUnit)
  if (convertedAmount === null) {
    return null
  }
  
  return (baseCalories / baseServingSize) * convertedAmount
}

/**
 * Returns a human-readable label for a unit
 */
export function getUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    g: 'grams',
    kg: 'kilograms',
    oz: 'ounces',
    lb: 'pounds',
    mg: 'milligrams',
    ml: 'milliliters',
    l: 'liters',
    cup: 'cups',
    Tbs: 'tablespoons',
    tsp: 'teaspoons',
    'fl-oz': 'fluid ounces',
    slice: 'slices',
    piece: 'pieces',
    serving: 'servings',
    portion: 'portions',
    loaf: 'loaves',
    can: 'cans',
    bottle: 'bottles',
    package: 'packages',
  }
  return labels[unit] || unit
}

/**
 * Gets all available units grouped by category
 */
export function getAllUnits(): { mass: string[]; volume: string[]; custom: string[] } {
  return {
    mass: [...MASS_UNITS],
    volume: [...VOLUME_UNITS],
    custom: [...CUSTOM_UNITS],
  }
}
