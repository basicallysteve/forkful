import { describe, it, expect } from 'vitest'
import { buildRecipeJsonLd, PAYWALLED_SELECTOR } from '@/utils/recipeJsonLd'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'

const food = (name: string): Food => ({
  id: 1, name, calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0,
  servingSize: 1, servingUnit: 'g', measurements: [{ unit: 'g' }],
})

const fullRecipe: Recipe = {
  id: 1,
  shortId: 'abc12345',
  name: 'Korean Beef Bowls',
  meal: 'Dinner',
  description: '<p>Savoury &amp; quick.</p>',
  ingredients: [
    { food: food('Beef'), quantity: 200, calories: 300, servingUnit: 'g' },
    { food: food('Rice'), quantity: 1, calories: 200, servingUnit: 'cup' },
  ],
  steps: [
    { id: 1, recipeId: 1, position: 0, title: 'Sear', content: '<p>Sear the <b>beef</b>.</p>' },
    { id: 2, recipeId: 1, position: 1, title: null, content: 'Serve over rice.' },
  ],
  prepTime: 10,
  cookTime: 20,
  totalTime: 90,
  cuisineType: 'Korean',
  dietaryTags: ['gluten-free'],
  serves: 4,
  isPublic: true,
  nutritionComplete: true,
}

describe('buildRecipeJsonLd', () => {
  it('always declares metered content with a paywall hasPart annotation', () => {
    const ld = buildRecipeJsonLd(fullRecipe)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Recipe')
    expect(ld.isAccessibleForFree).toBe(false)
    expect(ld.hasPart).toEqual({
      '@type': 'WebPageElement',
      isAccessibleForFree: false,
      cssSelector: PAYWALLED_SELECTOR,
    })
  })

  it('strips HTML and entities from the description', () => {
    expect(buildRecipeJsonLd(fullRecipe).description).toBe('Savoury & quick.')
  })

  it('maps metadata and ISO-8601 durations', () => {
    const ld = buildRecipeJsonLd(fullRecipe)
    expect(ld.recipeCategory).toBe('Dinner')
    expect(ld.recipeCuisine).toBe('Korean')
    expect(ld.recipeYield).toBe('4 servings')
    expect(ld.keywords).toBe('gluten-free')
    expect(ld.prepTime).toBe('PT10M')
    expect(ld.cookTime).toBe('PT20M')
    expect(ld.totalTime).toBe('PT1H30M')
  })

  it('includes ingredients and steps when present (full render)', () => {
    const ld = buildRecipeJsonLd(fullRecipe)
    expect(ld.recipeIngredient).toEqual(['200 g Beef', '1 cup Rice'])
    expect(ld.recipeInstructions).toEqual([
      { '@type': 'HowToStep', name: 'Sear', text: 'Sear the beef.' },
      { '@type': 'HowToStep', text: 'Serve over rice.' },
    ])
  })

  it('omits ingredients and steps for the gated summary payload', () => {
    const gated: Recipe = { ...fullRecipe, ingredients: [], steps: [] }
    const ld = buildRecipeJsonLd(gated)
    expect(ld.recipeIngredient).toBeUndefined()
    expect(ld.recipeInstructions).toBeUndefined()
    // still declared metered
    expect(ld.isAccessibleForFree).toBe(false)
  })
})
