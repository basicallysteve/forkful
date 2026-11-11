import { describe, it, expect } from 'vitest'
import {
  isAllowedCategory, normaliseUnit, deriveDensity, clampMacro, clampSodium, clampServing, clampCalories,
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
