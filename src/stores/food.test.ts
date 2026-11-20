import { describe, it, expect, beforeEach } from 'vitest'
import { useFoodStore, resetFoodStore } from './food'

const apple = { name: 'Test Apple', calories: 1, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [{ unit: 'g' }] }

describe('food store initial state', () => {
  it('starts empty, with no hard-coded sample foods', () => {
    expect(useFoodStore.getState().foods).toEqual([])
  })

  it('resetFoodStore returns to an empty store', () => {
    useFoodStore.getState().setFoods([{ ...apple, id: 9 }])
    resetFoodStore()
    expect(useFoodStore.getState().foods).toEqual([])
  })
})

describe('food store after reset', () => {
  beforeEach(() => resetFoodStore())

  it('assigns id 1 to the first added food', () => {
    useFoodStore.getState().addFood(apple)
    expect(useFoodStore.getState().foods.map(f => f.id)).toEqual([1])
  })
})
