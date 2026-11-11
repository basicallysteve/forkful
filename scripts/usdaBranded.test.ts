import { describe, it, expect } from 'vitest'
import {
  isAllowedCategory, normaliseUnit, deriveDensity, clampMacro, clampSodium, clampServing, clampCalories,
  parseServingSize, servingScale, uniqueSlug, indexBrandedByExternalId,
} from './usdaBranded'

describe('isAllowedCategory', () => {
  it('matches case-insensitively on substrings', () => {
    expect(isAllowedCategory('Cheese')).toBe(true)
    expect(isAllowedCategory('Frozen Poultry, Chicken Products')).toBe(true)
    expect(isAllowedCategory('BREAD & BUNS')).toBe(true)
  })
  it('rejects non-cooking categories', () => {
    expect(isAllowedCategory('Pet Food')).toBe(false)
    expect(isAllowedCategory('Vitamins')).toBe(false)
    expect(isAllowedCategory('')).toBe(false)
  })
})

describe('normaliseUnit', () => {
  it('maps aliases to the app vocabulary', () => {
    expect(normaliseUnit('Tablespoons')).toBe('Tbs')
    expect(normaliseUnit(' GRAM ')).toBe('g')
    expect(normaliseUnit('fl oz')).toBe('fl-oz')
  })
  it('returns null for custom or missing units', () => {
    expect(normaliseUnit('slice')).toBeNull()
    expect(normaliseUnit(undefined)).toBeNull()
    expect(normaliseUnit('')).toBeNull()
  })
})

describe('deriveDensity', () => {
  it('derives g/ml from a volume portion', () => {
    expect(deriveDensity('ml', 100, 100)).toBe(1)
    expect(deriveDensity('cup', 1, 236.588)).toBe(1)
    expect(deriveDensity('tbsp', 2, 30)).toBe(Math.round((30 / (14.787 * 2)) * 10000) / 10000)
  })
  it('returns null for non-volume units or bad input', () => {
    expect(deriveDensity('slice', 1, 30)).toBeNull()
    expect(deriveDensity('cup', 0, 30)).toBeNull()
    expect(deriveDensity('cup', 1, 0)).toBeNull()
    expect(deriveDensity('cup', 1, NaN)).toBeNull()
  })
})

describe('numeric clamping', () => {
  it('rounds to column scale', () => {
    expect(clampMacro(1.236)).toBe('1.24')
    expect(clampSodium(12.34)).toBe('12.3')
    expect(clampServing(30)).toBe('30')
    expect(clampCalories(99.5)).toBe(100)
  })
  it('caps values at column limits', () => {
    expect(clampMacro(1e12)).toBe('99999999.99')
    expect(clampServing(1e12)).toBe('99999999.99')
    expect(clampSodium(1e12)).toBe('999999999.9')
    expect(clampCalories(1e12)).toBe(2147483647)
  })
})

describe('non-finite values', () => {
  it('clamps Infinity and NaN to 0 instead of "NaN"', () => {
    for (const v of [Infinity, -Infinity, NaN]) {
      expect(clampMacro(v)).toBe('0')
      expect(clampServing(v)).toBe('0')
      expect(clampSodium(v)).toBe('0')
      expect(clampCalories(v)).toBe(0)
    }
  })
})

describe('parseServingSize', () => {
  it('parses valid sizes', () => expect(parseServingSize('28.5')).toBe(28.5))
  it('falls back to 100 for missing, NaN, Infinity or non-positive', () => {
    for (const raw of [undefined, '', 'abc', 'Infinity', '-5', '0']) {
      expect(parseServingSize(raw)).toBe(100)
    }
  })
})

describe('indexBrandedByExternalId', () => {
  const row = (id: number, externalId: string | null, source: string, dateDeleted: Date | null = null) =>
    ({ id, externalId, source, dateDeleted })

  it('matches usda_branded rows and flags soft-deleted', () => {
    const m = indexBrandedByExternalId([row(1, '100', 'usda_branded'), row(2, '200', 'usda_branded', new Date())])
    expect(m.get('100')).toEqual({ id: 1, isDeleted: false })
    expect(m.get('200')).toEqual({ id: 2, isDeleted: true })
  })
  it('never matches other sources or rows without externalId', () => {
    const m = indexBrandedByExternalId([
      row(3, '100', 'open_food_facts'), row(4, '300', 'manual'), row(5, null, 'usda_branded'),
    ])
    expect(m.size).toBe(0)
  })
})

describe('servingScale', () => {
  it('scales gram servings by grams / 100', () => expect(servingScale(30, 'g')).toBeCloseTo(0.3))
  it('converts other mass units', () => expect(servingScale(1, 'oz')).toBeCloseTo(0.283495))
  it('scales ml servings using the derived density', () => {
    expect(servingScale(240, 'ml', 1.03)).toBeCloseTo(2.472)
  })
  it('defaults to 1 g/ml when density is missing', () => {
    expect(servingScale(240, 'ml')).toBeCloseTo(2.4)
    expect(servingScale(1, 'cup')).toBeCloseTo(2.36588)
  })
  it('keeps the 100 g basis for other units or bad sizes', () => {
    expect(servingScale(2, 'slice')).toBe(1)
    expect(servingScale(Infinity, 'g')).toBe(1)
  })
})

describe('uniqueSlug', () => {
  it('returns the base when free', () => expect(uniqueSlug('milk', '123', new Set())).toBe('milk'))
  it('appends the fdcId on collision', () => {
    expect(uniqueSlug('milk', '123', new Set(['milk']))).toBe('milk-123')
  })
  it('handles an existing "Milk 123" slug alongside Milk (fdc 123)', () => {
    // toSlug('Milk 123') === 'milk-123' already taken, so fall through to a counter
    expect(uniqueSlug('milk', '123', new Set(['milk', 'milk-123']))).toBe('milk-123-2')
    expect(uniqueSlug('milk', '123', new Set(['milk', 'milk-123', 'milk-123-2']))).toBe('milk-123-3')
  })
  it('stays within 255 chars', () => {
    const base = 'a'.repeat(255)
    const slug = uniqueSlug(base, '123', new Set([base]))
    expect(slug.length).toBeLessThanOrEqual(255)
    expect(slug.endsWith('-123')).toBe(true)
  })
})
