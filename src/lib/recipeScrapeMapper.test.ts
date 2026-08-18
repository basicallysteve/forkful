import { describe, it, expect } from 'vitest'
import type { RecipeObject } from 'recipe-scrapers'
import { mapScrapedRecipe } from './recipeScrapeMapper'

type ParsedItem = NonNullable<RecipeObject['ingredients'][number]['items'][number]['parsed']>

function parsed(over: Partial<ParsedItem>): ParsedItem {
  return {
    quantity: null,
    quantity2: null,
    unitOfMeasureID: null,
    unitOfMeasure: null,
    description: '',
    isGroupHeader: false,
    ...over,
  }
}

function makeRaw(over: Partial<RecipeObject>): RecipeObject {
  return {
    schemaVersion: '1.0.0',
    host: 'example.com',
    title: 'Untitled',
    author: '',
    ingredients: [],
    instructions: [],
    canonicalUrl: '',
    image: '',
    totalTime: null,
    cookTime: null,
    prepTime: null,
    yields: '',
    description: '',
    siteName: null,
    category: [],
    ...over,
  } as RecipeObject
}

describe('mapScrapedRecipe', () => {
  it('maps top-level metadata', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        title: 'Chicken Curry',
        description: 'A cozy dinner.',
        prepTime: 15,
        cookTime: 40,
      })
    )
    expect(result.title).toBe('Chicken Curry')
    expect(result.description).toBe('A cozy dinner.')
    expect(result.prepTime).toBe(15)
    expect(result.cookTime).toBe(40)
  })

  it('maps a parsed ingredient, normalizing the unit to the app canonical unit', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        ingredients: [
          {
            name: null,
            items: [
              {
                value: '2 tablespoons olive oil',
                parsed: parsed({
                  quantity: 2,
                  unitOfMeasureID: 'tablespoon',
                  unitOfMeasure: 'tablespoons',
                  description: 'olive oil',
                }),
              },
            ],
          },
        ],
      })
    )
    expect(result.ingredients).toEqual([
      { raw: '2 tablespoons olive oil', quantity: 2, unit: 'Tbs', foodName: 'olive oil' },
    ])
  })

  it('passes an unrecognized unit through unchanged', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        ingredients: [
          {
            name: null,
            items: [
              {
                value: '1 clove garlic',
                parsed: parsed({ quantity: 1, unitOfMeasure: 'clove', description: 'garlic' }),
              },
            ],
          },
        ],
      })
    )
    expect(result.ingredients[0]).toMatchObject({ unit: 'clove', foodName: 'garlic' })
  })

  it('skips group-header ingredient items', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        ingredients: [
          {
            name: null,
            items: [
              { value: 'For the sauce', parsed: parsed({ description: 'For the sauce', isGroupHeader: true }) },
              { value: '1 cup milk', parsed: parsed({ quantity: 1, unitOfMeasureID: 'cup', description: 'milk' }) },
            ],
          },
        ],
      })
    )
    expect(result.ingredients).toHaveLength(1)
    expect(result.ingredients[0].foodName).toBe('milk')
  })

  it('falls back to parseIngredientLine when an item has no parsed data', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        ingredients: [
          { name: null, items: [{ value: '500g chicken breast', parsed: null }] },
        ],
      })
    )
    expect(result.ingredients[0]).toEqual({
      raw: '500g chicken breast',
      quantity: 500,
      unit: 'g',
      foodName: 'chicken breast',
    })
  })

  it('extracts the first integer from yields as serves', () => {
    expect(mapScrapedRecipe(makeRaw({ yields: '4 servings' })).serves).toBe(4)
    expect(mapScrapedRecipe(makeRaw({ yields: 'Serves 6-8' })).serves).toBe(6)
    expect(mapScrapedRecipe(makeRaw({ yields: 'Makes a dozen' })).serves).toBeNull()
  })

  it('picks a meal from category, case-insensitively, else null', () => {
    expect(mapScrapedRecipe(makeRaw({ category: ['main', 'dinner'] })).meal).toBe('Dinner')
    expect(mapScrapedRecipe(makeRaw({ category: ['Appetizer'] })).meal).toBeNull()
  })

  it('uses the canonical URL and site name for attribution when present', () => {
    const result = mapScrapedRecipe(
      makeRaw({ canonicalUrl: 'https://cooking.nytimes.com/canonical', siteName: 'NYT Cooking' }),
      'https://cooking.nytimes.com/input?utm=x'
    )
    expect(result.sourceUrl).toBe('https://cooking.nytimes.com/canonical')
    expect(result.sourceName).toBe('NYT Cooking')
  })

  it('falls back to the supplied URL when the scraper has no canonical URL', () => {
    const result = mapScrapedRecipe(makeRaw({ canonicalUrl: '', siteName: null }), 'https://example.com/r')
    expect(result.sourceUrl).toBe('https://example.com/r')
    expect(result.sourceName).toBeNull()
  })

  it('flattens instruction groups into a flat list of step strings', () => {
    const result = mapScrapedRecipe(
      makeRaw({
        instructions: [
          { name: null, items: [{ value: 'Chop the onion.' }, { value: 'Heat the pan.' }] },
          { name: 'Assembly', items: [{ value: 'Combine everything.' }] },
        ],
      })
    )
    expect(result.steps).toEqual(['Chop the onion.', 'Heat the pan.', 'Combine everything.'])
  })
})
