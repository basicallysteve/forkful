import { describe, it, expect } from 'vitest'
import { suggestPantryDeduction } from './pantryDeduction'
import { computePantryGapShortfall } from './pantryGap'

// The ingredient Food calibrates slice = 28 g; the pantry Product calibrates slice = 30 g.
// Each unit must resolve with the calibration of the thing it belongs to.
describe('suggestPantryDeduction with differing calibrations for the same unit', () => {
  it('converts 100 g into pantry slices at the pantry calibration (100 / 30)', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 100,
      ingredientUnit: 'g',
      ingredientMeasurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 28 }],
      pantryAmount: 10,
      pantryUnit: 'slice',
      pantryMeasurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 30 }],
    })
    expect(r.suggestedDeductAmount).toBeCloseTo(100 / 30, 5)
  })

  it('converts 2 ingredient slices (28 g) into pantry slices (30 g) via grams', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 2,
      ingredientUnit: 'slice',
      ingredientMeasurements: [{ unit: 'slice', gramsPerUnit: 28 }],
      pantryAmount: 10,
      pantryUnit: 'slice',
      pantryMeasurements: [{ unit: 'slice', gramsPerUnit: 30 }],
    })
    expect(r.suggestedDeductAmount).toBeCloseTo(56 / 30, 5)
  })
})

describe('pantry gap with differing calibrations for the same unit', () => {
  const base = { density: undefined }

  it('credits a stock slice (30 g) as 30/28 ingredient slices (28 g)', () => {
    const result = computePantryGapShortfall(
      { ...base, requiredQuantity: 2, unit: 'slice', measurements: [{ unit: 'slice', gramsPerUnit: 28 }] },
      [{ ...base, amount: 1, unit: 'slice', measurements: [{ unit: 'slice', gramsPerUnit: 30 }] }],
    )
    expect(result).toBeCloseTo(2 - 30 / 28, 2)
  })

  it('converts a gram ingredient against slice stock at the stock calibration', () => {
    // 100 g required; 2 stock slices at 30 g = 60 g, so 40 g short.
    const result = computePantryGapShortfall(
      { ...base, requiredQuantity: 100, unit: 'g', measurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 28 }] },
      [{ ...base, amount: 2, unit: 'slice', measurements: [{ unit: 'slice', gramsPerUnit: 30 }] }],
    )
    expect(result).toBe(40)
  })
})
