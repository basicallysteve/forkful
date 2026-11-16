import { describe, it, expect } from 'vitest'
import { useRecipeStore, resetRecipeStore } from './recipes'

describe('recipe store initial state', () => {
  it('starts empty', () => {
    expect(useRecipeStore.getState().recipes).toEqual([])
  })

  it('resetRecipeStore returns to an empty store', () => {
    resetRecipeStore()
    expect(useRecipeStore.getState().recipes).toEqual([])
  })
})
