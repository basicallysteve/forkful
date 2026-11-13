import { describe, it, expect } from 'vitest'
import { hasValidQuantities } from './ingredientQuantities'
import type { Ingredient } from '@/types/Ingredient'

const row = (quantity: number) => ({ quantity }) as Ingredient

describe('hasValidQuantities', () => {
  it('treats undefined ingredients as valid', () => {
    expect(hasValidQuantities(undefined)).toBe(true)
  })

  it('treats an empty list as valid', () => {
    expect(hasValidQuantities([])).toBe(true)
  })

  it('is valid when every quantity is positive', () => {
    expect(hasValidQuantities([row(1), row(0.5)])).toBe(true)
  })

  it('is invalid when any stored row has a zero quantity', () => {
    expect(hasValidQuantities([row(1), row(0)])).toBe(false)
  })
})
