import { describe, it, expect } from 'vitest'
import { convertFoodAmount } from '@/utils/convertFoodAmount'
import type { Food } from '@/types/Food'

type ConvFood = Pick<Food, 'measurements' | 'density'>

const slice30: ConvFood = { measurements: [{ unit: 'slice', gramsPerUnit: 30 }] }
const scoop: ConvFood = { measurements: [{ unit: 'scoop', mlPerUnit: 30 }] }
const scoopDense: ConvFood = { measurements: [{ unit: 'scoop', mlPerUnit: 30 }], density: 0.5 }
const both: ConvFood = { measurements: [{ unit: 'stick', gramsPerUnit: 100, mlPerUnit: 400 }], density: 1 }
const bare: ConvFood = { measurements: [{ unit: 'piece' }] }
const none: ConvFood = { measurements: [] }

describe('convertFoodAmount', () => {
  it.each([
    ['g -> slice via gramsPerUnit', slice30, 90, 'g', 'slice', 3],
    ['slice -> g via gramsPerUnit', slice30, 2, 'slice', 'g', 60],
    ['slice -> kg via gramsPerUnit', slice30, 1, 'slice', 'kg', 0.03],
    ['ml -> scoop via mlPerUnit, no density', scoop, 90, 'ml', 'scoop', 3],
    ['scoop -> ml via mlPerUnit, no density', scoop, 2, 'scoop', 'ml', 60],
    ['scoop -> l via mlPerUnit', scoop, 100, 'scoop', 'l', 3],
    ['scoop -> g via mlPerUnit and density', scoopDense, 2, 'scoop', 'g', 30],
    ['g -> scoop via density and mlPerUnit', scoopDense, 30, 'g', 'scoop', 2],
    ['grams preferred when both calibrations exist', both, 1, 'stick', 'g', 100],
    ['grams preferred going the other way', both, 200, 'g', 'stick', 2],
    ['same unit is identity', bare, 5, 'piece', 'piece', 5],
    ['standard to standard', none, 1, 'kg', 'g', 1000],
  ])('%s', (_name, food, amount, from, to, expected) => {
    expect(convertFoodAmount(food, amount, from, to)).toBeCloseTo(expected, 6)
  })

  it('an anchor of 1 slice with slice = 28 g reaches g', () => {
    const food: ConvFood = { measurements: [{ unit: 'slice', gramsPerUnit: 28 }] }
    expect(convertFoodAmount(food, 3, 'slice', 'g')).toBeCloseTo(84)
  })

  it.each([
    ['uncalibrated from', bare, 'piece', 'g'],
    ['uncalibrated to', bare, 'g', 'piece'],
    ['uncalibrated both', bare, 'piece', 'slice'],
    ['volume calibration to mass without density', scoop, 'scoop', 'g'],
    ['mass to volume without density', slice30, 'g', 'ml'],
    ['zero calibration', { measurements: [{ unit: 'slice', gramsPerUnit: 0 }] } as ConvFood, 'slice', 'g'],
  ])('returns null: %s', (_n, food, from, to) => {
    expect(convertFoodAmount(food, 1, from, to)).toBeNull()
  })
})
