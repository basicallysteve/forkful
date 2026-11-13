import { describe, it, expect } from 'vitest'
import type { PantryItem } from '@/types/PantryItem'
import { itemDisplayName } from './pantryItemName'

function item(overrides: Partial<PantryItem>): PantryItem {
  return {
    id: 1,
    sourceType: 'food',
    expirationDate: null,
    originalSize: { size: 1 },
    currentSize: { size: 1 },
    addedDate: new Date(),
    status: 'good',
    frozenDate: null,
    ...overrides,
  }
}

describe('itemDisplayName', () => {
  it('uses the food name for a food item', () => {
    expect(itemDisplayName(item({ food: { name: 'Chicken Breast' } as PantryItem['food'] }))).toBe('Chicken Breast')
  })

  it('uses the product name for a product item', () => {
    expect(itemDisplayName(item({ sourceType: 'product', product: { name: 'Oat Bar' } as PantryItem['product'] }))).toBe('Oat Bar')
  })

  it('uses the recipe name snapshot for a prepared meal', () => {
    expect(itemDisplayName(item({ sourceType: 'recipe', recipeNameSnapshot: 'Lasagne' }))).toBe('Lasagne')
  })

  it('falls back to "Prepared Meal" when the snapshot is missing', () => {
    expect(itemDisplayName(item({ sourceType: 'recipe', recipeNameSnapshot: null }))).toBe('Prepared Meal')
    expect(itemDisplayName(item({ sourceType: 'recipe' }))).toBe('Prepared Meal')
  })

  it('falls back to "item" when a food or product item has no name', () => {
    expect(itemDisplayName(item({}))).toBe('item')
  })
})
