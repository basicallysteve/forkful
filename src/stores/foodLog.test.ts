import { describe, it, expect, beforeEach } from 'vitest'
import { useFoodLogStore, resetFoodLogStore, sumMacros } from './foodLog'
import type { FoodLogEntry } from '@/types/FoodLogEntry'

function makeEntry(id: number, macros: Partial<FoodLogEntry>): FoodLogEntry {
  return {
    id,
    sourceType: 'food',
    foodId: id,
    food: null,
    amount: 1,
    unit: 'serving',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    logDate: '2026-08-19',
    dateAdded: new Date(),
    ...macros,
  }
}

describe('useFoodLogStore', () => {
  beforeEach(resetFoodLogStore)

  it('hydrates from a daily log', () => {
    const entries = [makeEntry(1, { calories: 100 })]
    useFoodLogStore.getState().setDailyLog({ logDate: '2026-08-19', entries, total: { calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0 } })
    expect(useFoodLogStore.getState().logDate).toBe('2026-08-19')
    expect(useFoodLogStore.getState().entries).toHaveLength(1)
  })

  it('appends a new entry and re-derives the running total', () => {
    const store = useFoodLogStore.getState()
    store.addEntry(makeEntry(1, { calories: 200, protein: 20, carbs: 10, fat: 5, fiber: 2 }))
    store.addEntry(makeEntry(2, { calories: 150, protein: 5, carbs: 30, fat: 3, fiber: 4 }))
    const total = useFoodLogStore.getState().getTotal()
    expect(total).toEqual({ calories: 350, protein: 25, carbs: 40, fat: 8, fiber: 6 })
  })
})

describe('sumMacros', () => {
  it('sums the five frozen macros and rounds to two places', () => {
    const total = sumMacros([
      makeEntry(1, { protein: 1.11 }),
      makeEntry(2, { protein: 2.22 }),
    ])
    expect(total.protein).toBe(3.33)
  })

  it('returns zeros for an empty day', () => {
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  })
})
