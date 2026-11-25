import { describe, it, expect } from 'vitest'
import { isNutritionComplete } from '@/utils/foodNutrition'
import type { Food } from '@/types/Food'

function food(over: Partial<Food> = {}): Food {
  return {
    id: 1,
    name: 'Rice',
    calories: 100,
    protein: 2,
    carbs: 20,
    fat: 0,
    fiber: 0,
    servingSize: 100,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }],
    ...over,
  } as Food
}

describe('isNutritionComplete', () => {
  it('is true when every ingredient resolves to calories from its Food', () => {
    const foods = new Map([[1, food()]])
    expect(isNutritionComplete([{ foodId: 1, quantity: 50, servingUnit: 'g' }], foods)).toBe(true)
  })

  it('is true for an empty ingredient list', () => {
    expect(isNutritionComplete([], new Map())).toBe(true)
  })

  it('is false when the unit has no calibration for the Food', () => {
    const foods = new Map([[1, food()]])
    expect(isNutritionComplete([{ foodId: 1, quantity: 1, servingUnit: 'cup' }], foods)).toBe(false)
  })

  it('is true when a calibrated unit resolves', () => {
    const foods = new Map([[1, food({ measurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 30 }] })]])
    expect(isNutritionComplete([{ foodId: 1, quantity: 2, servingUnit: 'slice' }], foods)).toBe(true)
  })

  it('is false when the Food has zero calories for a nonzero quantity', () => {
    const foods = new Map([[1, food({ calories: 0 })]])
    expect(isNutritionComplete([{ foodId: 1, quantity: 10, servingUnit: 'g' }], foods)).toBe(false)
  })

  it('ignores zero-quantity ingredients', () => {
    const foods = new Map([[1, food({ calories: 0 })]])
    expect(isNutritionComplete([{ foodId: 1, quantity: 0, servingUnit: 'g' }], foods)).toBe(true)
  })

  it('is false when the Food row was not found', () => {
    expect(isNutritionComplete([{ foodId: 7, quantity: 1, servingUnit: 'g' }], new Map())).toBe(false)
  })

  it('is false when any one ingredient is incomplete', () => {
    const foods = new Map([[1, food()], [2, food({ id: 2, calories: 0 })]])
    expect(
      isNutritionComplete(
        [
          { foodId: 1, quantity: 1, servingUnit: 'g' },
          { foodId: 2, quantity: 1, servingUnit: 'g' },
        ],
        foods,
      ),
    ).toBe(false)
  })
})
