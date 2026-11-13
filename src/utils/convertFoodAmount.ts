import type { Food } from '@/types/Food'
import { convertUnit, getUnitCategory } from '@/utils/unitConversion'

type Kind = 'mass' | 'volume'
type Canonical = { kind: Kind; value: number }

/** A Custom Unit's calibration as grams or ml per unit, grams tried first (ADR-0028). */
function calibration(food: Pick<Food, 'measurements'>, unit: string): Canonical | null {
  const m = food.measurements.find((x) => x.unit === unit)
  if (m?.gramsPerUnit && m.gramsPerUnit > 0) return { kind: 'mass', value: m.gramsPerUnit }
  if (m?.mlPerUnit && m.mlPerUnit > 0) return { kind: 'volume', value: m.mlPerUnit }
  return null
}

/**
 * Convert `amount` of `from` into `to` for a Food: standard units directly, Calibrated Custom Units
 * through their grams/ml per unit, and mass<->volume through Density. Returns null when any step is
 * unresolvable (uncalibrated unit, or mass<->volume without Density). Pure and framework-free so the
 * iOS port can reuse it (ADR-0028).
 */
export function convertFoodAmount(
  food: Pick<Food, 'measurements' | 'density'>,
  amount: number,
  from: string,
  to: string,
): number | null {
  if (from === to) return amount

  const fromCat = getUnitCategory(from)
  const toCat = getUnitCategory(to)

  // Standard <-> standard needs no calibration.
  if (fromCat !== 'custom' && toCat !== 'custom') {
    return convertUnit({ value: amount, fromUnit: from, toUnit: to, density: food.density })
  }

  // Resolve the source to grams or ml.
  let source: Canonical
  if (fromCat === 'custom') {
    const cal = calibration(food, from)
    if (!cal) return null
    source = { kind: cal.kind, value: amount * cal.value }
  } else {
    const kind: Kind = fromCat === 'mass' ? 'mass' : 'volume'
    const base = convertUnit({ value: amount, fromUnit: from, toUnit: kind === 'mass' ? 'g' : 'ml' })
    if (base === null) return null
    source = { kind, value: base }
  }

  // Express it in the target's base kind (grams or ml), then size it to the target unit.
  let targetKind: Kind
  let perUnit = 1
  if (toCat === 'custom') {
    const cal = calibration(food, to)
    if (!cal) return null
    targetKind = cal.kind
    perUnit = cal.value
  } else {
    targetKind = toCat === 'mass' ? 'mass' : 'volume'
  }

  let inTargetKind = source.value
  if (source.kind !== targetKind) {
    const density = food.density
    if (!density || density <= 0) return null
    inTargetKind = source.kind === 'mass' ? source.value / density : source.value * density
  }

  if (toCat === 'custom') return inTargetKind / perUnit
  return convertUnit({ value: inTargetKind, fromUnit: targetKind === 'mass' ? 'g' : 'ml', toUnit: to })
}
