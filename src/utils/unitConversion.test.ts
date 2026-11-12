import { describe, expect, it } from 'vitest'
import { CUSTOM_UNITS, EACH_UNIT, formatUnitForAmount, getUnitCategory, getUnitLabel, preferredShoppingUnit, shoppingUnitOptions } from './unitConversion'

describe('formatUnitForAmount', () => {
  it('leaves standard mass and volume symbols unchanged regardless of amount', () => {
    expect(formatUnitForAmount(6, 'g')).toBe('g')
    expect(formatUnitForAmount(1, 'g')).toBe('g')
    expect(formatUnitForAmount(2, 'oz')).toBe('oz')
    expect(formatUnitForAmount(3, 'ml')).toBe('ml')
    expect(formatUnitForAmount(4, 'cup')).toBe('cup')
    expect(formatUnitForAmount(5, 'fl-oz')).toBe('fl-oz')
  })

  it('pluralises custom units when the amount is not exactly one', () => {
    expect(formatUnitForAmount(6, 'fruit')).toBe('fruits')
    expect(formatUnitForAmount(2, 'piece')).toBe('pieces')
    expect(formatUnitForAmount(0, 'can')).toBe('cans')
  })

  it('keeps the singular form of a custom unit at exactly one', () => {
    expect(formatUnitForAmount(1, 'fruit')).toBe('fruit')
    expect(formatUnitForAmount(1, 'loaf')).toBe('loaf')
  })

  it('handles irregular plurals', () => {
    expect(formatUnitForAmount(3, 'loaf')).toBe('loaves')
    expect(formatUnitForAmount(2, 'box')).toBe('boxes')
  })

  it('treats fractional amounts other than one as plural', () => {
    expect(formatUnitForAmount(0.5, 'fruit')).toBe('fruits')
    expect(formatUnitForAmount(1.5, 'fruit')).toBe('fruits')
  })

  it('returns an empty string unchanged', () => {
    expect(formatUnitForAmount(2, '')).toBe('')
  })

  it('leaves the Each Count Unit invariant in the plural', () => {
    expect(formatUnitForAmount(1, EACH_UNIT)).toBe('each')
    expect(formatUnitForAmount(6, EACH_UNIT)).toBe('each')
    expect(formatUnitForAmount(0.5, EACH_UNIT)).toBe('each')
  })
})

describe('preferredShoppingUnit', () => {
  it('prefers the food’s first custom unit', () => {
    expect(preferredShoppingUnit(['g', 'piece'])).toBe('piece')
    expect(preferredShoppingUnit(['oz', 'slice', 'g'])).toBe('slice')
  })

  it('falls back to "each" when the food has only mass/volume units', () => {
    expect(preferredShoppingUnit(['g'])).toBe('each')
    expect(preferredShoppingUnit(['cup'])).toBe('each')
    expect(preferredShoppingUnit([])).toBe('each')
  })
})

describe('shoppingUnitOptions', () => {
  it('appends the Each Count Unit and lists custom units first', () => {
    expect(shoppingUnitOptions(['g', 'oz'])).toEqual(['each', 'g', 'oz'])
    expect(shoppingUnitOptions(['g', 'piece'])).toEqual(['piece', 'each', 'g'])
  })

  it('does not duplicate "each" when the food already lists it', () => {
    expect(shoppingUnitOptions(['each', 'g'])).toEqual(['each', 'g'])
  })
})

describe('more count units (#182)', () => {
  const NEW_UNITS = ['scoop', 'stick', 'tablet', 'pouch', 'punnet', 'bar', 'packet']

  it('lists the new units as built-in custom units', () => {
    for (const unit of NEW_UNITS) expect(CUSTOM_UNITS).toContain(unit)
  })

  it('categorises the new units as custom', () => {
    for (const unit of NEW_UNITS) expect(getUnitCategory(unit)).toBe('custom')
  })

  it('pluralises them by amount', () => {
    expect(formatUnitForAmount(2, 'scoop')).toBe('scoops')
    expect(formatUnitForAmount(1, 'stick')).toBe('stick')
    expect(formatUnitForAmount(0.5, 'stick')).toBe('sticks')
    expect(formatUnitForAmount(3, 'punnet')).toBe('punnets')
    expect(formatUnitForAmount(2, 'packet')).toBe('packets')
  })

  it('gives each a plural label', () => {
    expect(getUnitLabel('scoop')).toBe('scoops')
    expect(getUnitLabel('stick')).toBe('sticks')
    expect(getUnitLabel('tablet')).toBe('tablets')
    expect(getUnitLabel('pouch')).toBe('pouches')
    expect(getUnitLabel('punnet')).toBe('punnets')
    expect(getUnitLabel('bar')).toBe('bars')
    expect(getUnitLabel('packet')).toBe('packets')
  })
})
