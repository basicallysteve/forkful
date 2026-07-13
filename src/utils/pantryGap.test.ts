import { describe, it, expect } from 'vitest'
import { computePantryGapShortfall, type PantryGapIngredient, type PantryGapStock } from './pantryGap'

// A gram-anchored ingredient with an optional Calibrated Custom Unit ("slice" = 30g).
function ingredient(overrides: Partial<PantryGapIngredient> = {}): PantryGapIngredient {
  return {
    requiredQuantity: 200,
    unit: 'g',
    density: undefined,
    measurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 30 }],
    ...overrides,
  }
}

function stock(overrides: Partial<PantryGapStock> = {}): PantryGapStock {
  return {
    amount: 100,
    unit: 'g',
    density: undefined,
    measurements: [{ unit: 'g' }],
    ...overrides,
  }
}

describe('computePantryGapShortfall', () => {
  it('returns the full required quantity when nothing is in stock', () => {
    expect(computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [])).toBe(200)
  })

  it('skips a fully-stocked ingredient (returns null)', () => {
    // 200 g required, 250 g on hand → nothing to buy.
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [stock({ amount: 250 })])
    expect(result).toBeNull()
  })

  it('skips an exactly-covered ingredient', () => {
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [stock({ amount: 200 })])
    expect(result).toBeNull()
  })

  it('returns the partial shortfall when stock covers only part of the requirement', () => {
    // 200 g required, 120 g on hand → 80 g shortfall.
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [stock({ amount: 120 })])
    expect(result).toBe(80)
  })

  it('sums multiple matching stock entries before computing the shortfall', () => {
    // 200 g required; 100 g + 60 g on hand → 40 g shortfall.
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [
      stock({ amount: 100 }),
      stock({ amount: 60 }),
    ])
    expect(result).toBe(40)
  })

  it('converts stock across standard units before subtracting', () => {
    // 200 g required; 0.1 kg on hand → 100 g → 100 g shortfall.
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [stock({ amount: 0.1, unit: 'kg' })])
    expect(result).toBe(100)
  })

  it('converts a Calibrated Custom Unit ingredient against gram stock', () => {
    // 10 slices required (30 g each = 300 g); 90 g on hand = 3 slices → 7-slice shortfall.
    const result = computePantryGapShortfall(
      ingredient({ requiredQuantity: 10, unit: 'slice' }),
      [stock({ amount: 90, unit: 'g' })],
    )
    expect(result).toBe(7)
  })

  it('credits convertible stock and ignores an unconvertible entry beside it', () => {
    // 200 g required; 120 g convertible on hand plus 3 uncalibrated "can" we can't measure → credit only
    // the 120 g, leaving an 80 g shortfall (not the full 200 g the old discard-everything path gave).
    const result = computePantryGapShortfall(ingredient({ requiredQuantity: 200 }), [
      stock({ amount: 120, unit: 'g' }),
      stock({ amount: 3, unit: 'can', measurements: [{ unit: 'can' }] }),
    ])
    expect(result).toBe(80)
  })

  it('falls back to the full required quantity for an Uncalibrated Custom Unit ingredient', () => {
    // "clove" has no gram-weight, so gram stock can't be converted → buy the whole requirement.
    const result = computePantryGapShortfall(
      ingredient({ requiredQuantity: 6, unit: 'clove', measurements: [{ unit: 'clove' }] }),
      [stock({ amount: 500, unit: 'g' })],
    )
    expect(result).toBe(6)
  })

  it('compares directly when ingredient and stock share an Uncalibrated Custom Unit', () => {
    // Both sides are "each" — no gram-weight needed for a same-unit comparison. 6 required, 4 on hand → 2.
    const result = computePantryGapShortfall(
      ingredient({ requiredQuantity: 6, unit: 'each', measurements: [{ unit: 'each' }] }),
      [stock({ amount: 4, unit: 'each' })],
    )
    expect(result).toBe(2)
  })

  it('falls back to the full required quantity when an unconvertible unit pair is on hand', () => {
    // Required in ml (volume), stock in g (mass) with no density → unconvertible → full requirement.
    const result = computePantryGapShortfall(
      ingredient({ requiredQuantity: 250, unit: 'ml', measurements: [{ unit: 'ml' }] }),
      [stock({ amount: 100, unit: 'g' })],
    )
    expect(result).toBe(250)
  })
})
