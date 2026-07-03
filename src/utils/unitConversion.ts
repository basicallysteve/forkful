import convert from 'convert-units'

export type UnitCategory = 'mass' | 'volume' | 'custom'

export const MASS_UNITS = ['g', 'kg', 'oz', 'lb', 'mg'] as const
export type MassUnit = typeof MASS_UNITS[number]

export const VOLUME_UNITS = ['ml', 'l', 'cup', 'Tbs', 'tsp', 'fl-oz'] as const
export type VolumeUnit = typeof VOLUME_UNITS[number]

export const CUSTOM_UNITS = ['slice', 'piece', 'serving', 'portion', 'loaf', 'can', 'bottle', 'package'] as const
export type CustomUnit = typeof CUSTOM_UNITS[number]

export type FoodUnit = MassUnit | VolumeUnit | CustomUnit

export function getUnitCategory(unit: string): UnitCategory {
  if (MASS_UNITS.includes(unit as MassUnit)) return 'mass'
  if (VOLUME_UNITS.includes(unit as VolumeUnit)) return 'volume'
  return 'custom'
}

export function canConvert(fromUnit: string, toUnit: string, density?: number): boolean {
  const fromCat = getUnitCategory(fromUnit)
  const toCat = getUnitCategory(toUnit)
  if (fromCat === 'custom' || toCat === 'custom') return false
  if (fromCat === toCat) return true
  return !!(density && density > 0)
}

export function convertUnit({ value, fromUnit, toUnit, density }: { value: number; fromUnit: string; toUnit: string; density?: number }): number | null {
  if (fromUnit === toUnit) return value

  const fromCat = getUnitCategory(fromUnit)
  const toCat = getUnitCategory(toUnit)

  if (fromCat === 'custom' || toCat === 'custom') return null

  try {
    if (fromCat === toCat) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return convert(value).from(fromUnit as any).to(toUnit as any)
    }

    if (!density || density <= 0) return null

    if (fromCat === 'mass' && toCat === 'volume') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grams = convert(value).from(fromUnit as any).to('g' as any)
      const ml = grams / density
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return convert(ml).from('ml' as any).to(toUnit as any)
    }

    // volume → mass
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ml = convert(value).from(fromUnit as any).to('ml' as any)
    const grams = ml * density
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return convert(grams).from('g' as any).to(toUnit as any)
  } catch {
    return null
  }
}

export function getAllowedUnits(baseUnit: string, density?: number): string[] {
  const category = getUnitCategory(baseUnit)
  const hasDensity = density != null && density > 0

  if (category === 'mass') {
    return hasDensity ? [...MASS_UNITS, ...VOLUME_UNITS] : [...MASS_UNITS]
  }
  if (category === 'volume') {
    return hasDensity ? [...VOLUME_UNITS, ...MASS_UNITS] : [...VOLUME_UNITS]
  }
  return [baseUnit, ...CUSTOM_UNITS.filter(u => u !== baseUnit)]
}

/** True when a unit is neither a standard mass nor volume unit — i.e. a natural "purchase" unit (piece, can, fruit, bunch, …). */
export function isCustomUnit(unit: string): boolean {
  return getUnitCategory(unit) === 'custom'
}

/** Order units so Custom Units come first (the natural purchase units), preserving each group's original order. */
export function sortUnitsCustomFirst(units: string[]): string[] {
  return [
    ...units.filter(isCustomUnit),
    ...units.filter((unit) => !isCustomUnit(unit)),
  ]
}

/**
 * The unit a shopping line should default to when a Food is selected: the first Custom Unit if the
 * Food has one (so you buy "5 limes", not "100 g of limes"), otherwise the serving unit, otherwise
 * the first available unit.
 */
export function preferredShoppingUnit(units: string[], servingUnit?: string): string {
  const firstCustom = units.find(isCustomUnit)
  if (firstCustom) return firstCustom
  if (servingUnit && units.includes(servingUnit)) return servingUnit
  return units[0] ?? servingUnit ?? ''
}

export interface CalculateCaloriesParams {
  baseCalories: number
  baseServingSize: number
  baseServingUnit: string
  targetAmount: number
  targetUnit: string
  gramsPerUnit?: number
  density?: number
}

export function calculateCalories({
  baseCalories,
  baseServingSize,
  baseServingUnit,
  targetAmount,
  targetUnit,
  gramsPerUnit,
  density,
}: CalculateCaloriesParams): number | null {

  if (baseServingUnit === targetUnit) {
    return (baseCalories / baseServingSize) * targetAmount
  }

  if (getUnitCategory(targetUnit) === 'custom') {
    if (!gramsPerUnit || gramsPerUnit <= 0) return null
    const gramsAmount = targetAmount * gramsPerUnit
    const convertedAmount = convertUnit({ value: gramsAmount, fromUnit: 'g', toUnit: baseServingUnit, density })
    if (convertedAmount === null) return null
    return (baseCalories / baseServingSize) * convertedAmount
  }

  const convertedAmount = convertUnit({ value: targetAmount, fromUnit: targetUnit, toUnit: baseServingUnit, density })
  if (convertedAmount === null) return null
  return (baseCalories / baseServingSize) * convertedAmount
}

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

export function getAllUnits(): { mass: string[]; volume: string[]; custom: string[] } {
  return {
    mass: [...MASS_UNITS],
    volume: [...VOLUME_UNITS],
    custom: [...CUSTOM_UNITS],
  }
}
