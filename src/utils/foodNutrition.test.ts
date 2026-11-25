import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { caloriesFor, macrosFor, unitResolvesForFood } from '@/utils/foodNutrition'

// Per 100 g: 250 kcal. One slice weighs 28 g, so a slice is 70 kcal (the figure the server computes).
const bread = {
  calories: 250,
  protein: 10,
  carbs: 50,
  fat: 5,
  fiber: 4,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'slice', gramsPerUnit: 28 }],
}

// Per 30 g: 120 kcal. A scoop is calibrated by volume (60 ml); at 0.5 g/ml that is 30 g.
const powder = {
  calories: 120,
  protein: 24,
  carbs: 3,
  fat: 2,
  fiber: 1,
  servingSize: 30,
  servingUnit: 'g',
  measurements: [{ unit: 'scoop', mlPerUnit: 60 }],
  density: 0.5,
}

describe('macrosFor', () => {
  it('scales all five macros by the amount in the serving unit', () => {
    expect(macrosFor(bread, 200, 'g')).toEqual({ calories: 500, protein: 20, carbs: 100, fat: 10, fiber: 8 })
  })

  it('returns the stored macros at exactly one serving', () => {
    expect(macrosFor(bread, 100, 'g')).toEqual({ calories: 250, protein: 10, carbs: 50, fat: 5, fiber: 4 })
  })

  it('converts a standard unit (oz) to the serving unit', () => {
    // 1 oz = 28.3495 g.
    expect(macrosFor(bread, 1, 'oz')?.calories).toBeCloseTo(70.87, 1)
  })

  it('resolves a gram-calibrated slice to 70 kcal', () => {
    expect(macrosFor(bread, 1, 'slice')?.calories).toBeCloseTo(70, 6)
  })

  it('resolves an ml-calibrated scoop through density', () => {
    expect(macrosFor(powder, 1, 'scoop')).toEqual({ calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 1 })
  })

  it('converts a volume unit to a mass serving through density', () => {
    const oil = { ...bread, calories: 120, servingSize: 14, measurements: [], density: 0.92 }
    // 1 Tbs = 14.7868 ml = 13.604 g of oil.
    expect(macrosFor(oil, 1, 'Tbs')?.calories).toBeCloseTo(116.6, 1)
  })

  it('does not round, so ingredient calories keep full precision', () => {
    const calories = macrosFor(bread, 1, 'oz')?.calories as number
    expect(calories).not.toBe(Math.round(calories * 100) / 100)
  })

  it('returns null for an uncalibrated custom unit', () => {
    expect(macrosFor({ ...bread, measurements: [{ unit: 'slice' }] }, 1, 'slice')).toBeNull()
  })

  it('returns null for a volume unit when the food has no density', () => {
    expect(macrosFor(bread, 1, 'cup')).toBeNull()
  })

  it('returns null when the serving size is not positive', () => {
    expect(macrosFor({ ...bread, servingSize: 0 }, 1, 'g')).toBeNull()
  })
})

describe('caloriesFor', () => {
  it('returns the calories of macrosFor', () => {
    expect(caloriesFor(bread, 1, 'slice')).toBeCloseTo(70, 6)
    expect(caloriesFor(powder, 2, 'scoop')).toBe(240)
  })

  it('returns null when the amount cannot be resolved', () => {
    expect(caloriesFor(bread, 1, 'cup')).toBeNull()
  })
})

describe('unitResolvesForFood', () => {
  const base = { servingSize: 100, servingUnit: 'g' }

  it('is true for the base serving unit', () => {
    expect(unitResolvesForFood({ ...base, measurements: [] }, 'g')).toBe(true)
  })

  it('is true for a mass unit convertible to the base', () => {
    expect(unitResolvesForFood({ ...base, measurements: [] }, 'oz')).toBe(true)
  })

  it('is true for a custom unit that has a weight', () => {
    expect(unitResolvesForFood({ ...base, measurements: [{ unit: 'slice', gramsPerUnit: 28 }] }, 'slice')).toBe(true)
  })

  it('is false for a custom unit with no weight', () => {
    expect(unitResolvesForFood({ ...base, measurements: [{ unit: 'slice' }] }, 'slice')).toBe(false)
  })

  it('is false when the food has no positive serving size, even for its own unit', () => {
    expect(unitResolvesForFood({ servingSize: 0, servingUnit: 'g', measurements: [] }, 'g')).toBe(false)
  })

  it('is false for a volume unit when the food has no density or volume calibration', () => {
    expect(unitResolvesForFood({ ...base, measurements: [{ unit: 'cup' }] }, 'cup')).toBe(false)
  })
})

describe('module boundaries', () => {
  const read = (file: string) => readFileSync(join(process.cwd(), 'src/utils', file), 'utf8')

  it('foodNutrition imports nothing from next, the database or React', () => {
    const imports = read('foodNutrition.ts').match(/from\s+['"][^'"]+['"]/g) ?? []
    expect(imports.length).toBeGreaterThan(0)
    for (const spec of imports) {
      expect(spec).not.toMatch(/next|@\/db|react|drizzle/)
    }
  })

  it('unitConversion does not import convertFoodAmount (no import cycle, #214)', () => {
    expect(read('unitConversion.ts')).not.toContain('convertFoodAmount')
  })
})
