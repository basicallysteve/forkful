import { describe, it, expect } from 'vitest'
import { suggestPantryDeduction } from './pantryDeduction'

const slice28 = [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 28 }]

describe('suggestPantryDeduction', () => {
  it('deducts 2 slice from 100 g stock, leaving 44 g (slice = 28 g)', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 2,
      ingredientUnit: 'slice',
      ingredientMeasurements: slice28,
      pantryAmount: 100,
      pantryUnit: 'g',
      pantryMeasurements: [{ unit: 'g' }],
    })
    expect(r.canAutoConvert).toBe(true)
    expect(r.suggestedDeductAmount).toBe(56)
    expect(100 - (r.suggestedDeductAmount ?? 0)).toBe(44)
  })

  it('converts a gram ingredient into pantry stock held in a calibrated count unit', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 56,
      ingredientUnit: 'g',
      ingredientMeasurements: [{ unit: 'g' }],
      pantryAmount: 10,
      pantryUnit: 'slice',
      pantryMeasurements: slice28,
    })
    expect(r).toEqual({ canAutoConvert: true, suggestedDeductAmount: 2 })
  })

  it('calibrates by volume when only mlPerUnit is set', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 2,
      ingredientUnit: 'scoop',
      ingredientMeasurements: [{ unit: 'scoop', mlPerUnit: 30 }],
      pantryAmount: 500,
      pantryUnit: 'ml',
      pantryMeasurements: [{ unit: 'ml' }],
    })
    expect(r).toEqual({ canAutoConvert: true, suggestedDeductAmount: 60 })
  })

  it('caps the suggestion at the stock on hand', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 5,
      ingredientUnit: 'slice',
      ingredientMeasurements: slice28,
      pantryAmount: 100,
      pantryUnit: 'g',
      pantryMeasurements: [{ unit: 'g' }],
    })
    expect(r.suggestedDeductAmount).toBe(100)
  })

  it('still converts standard units, using density across mass and volume', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 1,
      ingredientUnit: 'cup',
      ingredientMeasurements: [{ unit: 'cup' }],
      pantryAmount: 1000,
      pantryUnit: 'g',
      pantryMeasurements: [{ unit: 'g' }],
      density: 1,
    })
    expect(r.canAutoConvert).toBe(true)
    expect(r.suggestedDeductAmount).toBeGreaterThan(200)
  })

  it('falls back to manual entry for an uncalibrated custom unit', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 2,
      ingredientUnit: 'slice',
      ingredientMeasurements: [{ unit: 'slice' }],
      pantryAmount: 100,
      pantryUnit: 'g',
      pantryMeasurements: [{ unit: 'g' }],
    })
    expect(r).toEqual({ canAutoConvert: false, suggestedDeductAmount: null })
  })

  it('falls back to manual entry for mass to volume without density', () => {
    const r = suggestPantryDeduction({
      ingredientQuantity: 1,
      ingredientUnit: 'cup',
      ingredientMeasurements: [{ unit: 'cup' }],
      pantryAmount: 1000,
      pantryUnit: 'g',
      pantryMeasurements: [{ unit: 'g' }],
    })
    expect(r).toEqual({ canAutoConvert: false, suggestedDeductAmount: null })
  })
})
