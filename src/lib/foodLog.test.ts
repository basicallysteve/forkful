import { describe, it, expect } from 'vitest'
import { computeFrozenMacros } from './foodLog'
import type { Food } from '@/types/Food'

// A Food whose nutrition is defined per 100 g, with a calibrated custom "slice" unit (30 g each).
const bread: Food = {
  id: 1,
  name: 'Test Bread',
  calories: 250,
  protein: 8,
  carbs: 48,
  fat: 3,
  fiber: 4,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 30 }],
}

describe('computeFrozenMacros', () => {
  it('scales all five macros by the amount in the base serving unit', () => {
    const macros = computeFrozenMacros(bread, 200, 'g')
    expect(macros).toEqual({ calories: 500, protein: 16, carbs: 96, fat: 6, fiber: 8 })
  })

  it('returns the per-serving macros unchanged at exactly one serving', () => {
    const macros = computeFrozenMacros(bread, 100, 'g')
    expect(macros).toEqual({ calories: 250, protein: 8, carbs: 48, fat: 3, fiber: 4 })
  })

  it('converts a cross-unit amount (oz → g) before scaling', () => {
    // 1 oz = 28.3495 g → factor 0.283495 of a 100 g serving.
    const macros = computeFrozenMacros(bread, 1, 'oz')
    expect(macros.calories).toBeCloseTo(70.87, 1)
    expect(macros.protein).toBeCloseTo(2.27, 1)
  })

  it('uses gramsPerUnit for a calibrated custom unit', () => {
    // 2 slices × 30 g = 60 g → 0.6 of a serving.
    const macros = computeFrozenMacros(bread, 2, 'slice')
    expect(macros).toEqual({ calories: 150, protein: 4.8, carbs: 28.8, fat: 1.8, fiber: 2.4 })
  })

  it('returns zero macros for an uncalibrated custom unit rather than throwing', () => {
    const macros = computeFrozenMacros(bread, 1, 'piece')
    expect(macros).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  })
})
