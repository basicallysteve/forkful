import { describe, it, expect } from 'vitest'
import { parseRecipeMarkdown, parseIngredientLine, isKnownUnit } from './recipeMarkdownParser'

describe('parseIngredientLine', () => {
  it('parses quantity attached to unit (500g chicken breast)', () => {
    const result = parseIngredientLine('- 500g chicken breast')
    expect(result).toEqual({ raw: '- 500g chicken breast', quantity: 500, unit: 'g', foodName: 'chicken breast' })
  })

  it('parses quantity separated from unit (2 cup yogurt)', () => {
    const result = parseIngredientLine('- 2 cup yogurt')
    expect(result).toEqual({ raw: '- 2 cup yogurt', quantity: 2, unit: 'cup', foodName: 'yogurt' })
  })

  it('parses decimal quantities (2.5 oz butter)', () => {
    const result = parseIngredientLine('2.5 oz butter')
    expect(result).toEqual({ raw: '2.5 oz butter', quantity: 2.5, unit: 'oz', foodName: 'butter' })
  })

  it('parses multi-word food names (1 tsp black pepper)', () => {
    const result = parseIngredientLine('1 tsp black pepper')
    expect(result).toEqual({ raw: '1 tsp black pepper', quantity: 1, unit: 'tsp', foodName: 'black pepper' })
  })

  it('returns nulls for lines that do not match the pattern', () => {
    const result = parseIngredientLine('some random text')
    expect(result.quantity).toBeNull()
    expect(result.unit).toBeNull()
    expect(result.foodName).toBeNull()
  })

  it('handles comma as decimal separator (1,5 kg flour)', () => {
    const result = parseIngredientLine('1,5 kg flour')
    expect(result.quantity).toBe(1.5)
    expect(result.unit).toBe('kg')
    expect(result.foodName).toBe('flour')
  })
})

describe('parseIngredientLine — unit normalisation', () => {
  it('normalises lowercase tbs to canonical Tbs', () => {
    expect(parseIngredientLine('2 tbs olive oil').unit).toBe('Tbs')
  })

  it('normalises uppercase G to canonical g', () => {
    expect(parseIngredientLine('100 G flour').unit).toBe('g')
  })

  it('preserves unknown units unchanged', () => {
    expect(parseIngredientLine('1 handful spinach').unit).toBe('handful')
  })

  it('normalises fl-oz regardless of case', () => {
    expect(parseIngredientLine('2 FL-OZ milk').unit).toBe('fl-oz')
  })
})

describe('isKnownUnit', () => {
  it('recognises mass units', () => {
    expect(isKnownUnit('g')).toBe(true)
    expect(isKnownUnit('kg')).toBe(true)
    expect(isKnownUnit('oz')).toBe(true)
    expect(isKnownUnit('lb')).toBe(true)
    expect(isKnownUnit('mg')).toBe(true)
  })

  it('recognises volume units', () => {
    expect(isKnownUnit('ml')).toBe(true)
    expect(isKnownUnit('l')).toBe(true)
    expect(isKnownUnit('cup')).toBe(true)
    expect(isKnownUnit('Tbs')).toBe(true)
    expect(isKnownUnit('tsp')).toBe(true)
    expect(isKnownUnit('fl-oz')).toBe(true)
  })

  it('rejects unknown units', () => {
    expect(isKnownUnit('handful')).toBe(false)
    expect(isKnownUnit('bunch')).toBe(false)
    expect(isKnownUnit('pinch')).toBe(false)
  })
})

describe('parseRecipeMarkdown', () => {
  const FULL_TEMPLATE = `# Chicken Tikka Masala
meal: Dinner
serves: 4
prepTime: 20
cookTime: 40

## Description
A rich, creamy curry with tender chicken pieces.

## Ingredients
- 500g chicken breast
- 2 cup yogurt
- 1 tsp cumin

## Steps
1. Marinate chicken in yogurt for 30 minutes.
2. Cook onions until golden.
3. Add spices and tomatoes, simmer 20 minutes.
`

  it('parses the title', () => {
    const result = parseRecipeMarkdown(FULL_TEMPLATE)
    expect(result.title).toBe('Chicken Tikka Masala')
  })

  it('parses metadata fields', () => {
    const result = parseRecipeMarkdown(FULL_TEMPLATE)
    expect(result.meal).toBe('Dinner')
    expect(result.serves).toBe(4)
    expect(result.prepTime).toBe(20)
    expect(result.cookTime).toBe(40)
  })

  it('parses the description', () => {
    const result = parseRecipeMarkdown(FULL_TEMPLATE)
    expect(result.description).toBe('A rich, creamy curry with tender chicken pieces.')
  })

  it('parses all ingredients', () => {
    const result = parseRecipeMarkdown(FULL_TEMPLATE)
    expect(result.ingredients).toHaveLength(3)
    expect(result.ingredients[0]).toMatchObject({ quantity: 500, unit: 'g', foodName: 'chicken breast' })
    expect(result.ingredients[1]).toMatchObject({ quantity: 2, unit: 'cup', foodName: 'yogurt' })
    expect(result.ingredients[2]).toMatchObject({ quantity: 1, unit: 'tsp', foodName: 'cumin' })
  })

  it('parses all steps (stripping the numbering)', () => {
    const result = parseRecipeMarkdown(FULL_TEMPLATE)
    expect(result.steps).toHaveLength(3)
    expect(result.steps[0]).toBe('Marinate chicken in yogurt for 30 minutes.')
    expect(result.steps[1]).toBe('Cook onions until golden.')
    expect(result.steps[2]).toBe('Add spices and tomatoes, simmer 20 minutes.')
  })

  it('returns nulls for missing metadata fields', () => {
    const minimal = `# Simple Recipe\n\n## Ingredients\n- 1 cup rice\n`
    const result = parseRecipeMarkdown(minimal)
    expect(result.meal).toBeNull()
    expect(result.serves).toBeNull()
    expect(result.prepTime).toBeNull()
    expect(result.cookTime).toBeNull()
  })

  it('returns empty arrays when sections are missing', () => {
    const noIngredients = `# Recipe\nmeal: Lunch\n\n## Steps\n1. Do something.\n`
    const result = parseRecipeMarkdown(noIngredients)
    expect(result.ingredients).toHaveLength(0)
    expect(result.steps).toHaveLength(1)
  })

  it('ignores non-list lines inside the Ingredients section', () => {
    const withNoise = `# Recipe\n\n## Ingredients\n- 2 cup flour\nsome random note\n- 1 tsp salt\n`
    const result = parseRecipeMarkdown(withNoise)
    expect(result.ingredients).toHaveLength(2)
  })

  it('ignores non-numbered lines inside the Steps section', () => {
    const withNoise = `# Recipe\n\n## Steps\n1. First step.\nOptional note.\n2. Second step.\n`
    const result = parseRecipeMarkdown(withNoise)
    expect(result.steps).toHaveLength(2)
  })

  it('handles case-insensitive metadata keys', () => {
    const mixed = `# Recipe\nMeal: Breakfast\nServes: 2\n`
    const result = parseRecipeMarkdown(mixed)
    expect(result.meal).toBe('Breakfast')
    expect(result.serves).toBe(2)
  })

  it('returns an empty title and no content for an empty string', () => {
    const result = parseRecipeMarkdown('')
    expect(result.title).toBe('')
    expect(result.ingredients).toHaveLength(0)
    expect(result.steps).toHaveLength(0)
  })
})
