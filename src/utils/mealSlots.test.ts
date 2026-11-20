import { describe, it, expect } from 'vitest'
import { groupEntriesBySlot } from './mealSlots'
import type { FoodLogEntry } from '@/types/FoodLogEntry'

function entry(id: number, mealSlot: string | null): FoodLogEntry {
  return {
    id, sourceType: 'food', foodId: 1, food: null, amount: 1, unit: 'g',
    calories: 10, protein: 1, carbs: 1, fat: 1, fiber: 1,
    logDate: '2026-11-16', dateAdded: new Date(2026, 10, 16, 8, id), mealSlot,
  }
}

describe('groupEntriesBySlot', () => {
  it('returns one group per configured slot, in the configured order, even when empty', () => {
    const groups = groupEntriesBySlot([entry(1, 'Brunch'), entry(2, 'Breakfast')], ['Breakfast', 'Brunch'])
    expect(groups.map((g) => g.label)).toEqual(['Breakfast', 'Brunch'])
    expect(groups[0].entries.map((e) => e.id)).toEqual([2])
    expect(groups[1].entries.map((e) => e.id)).toEqual([1])
  })

  it('follows a reordered slot list rather than a fixed order', () => {
    const groups = groupEntriesBySlot([], ['Dinner', 'Breakfast'])
    expect(groups.map((g) => g.label)).toEqual(['Dinner', 'Breakfast'])
  })

  it('puts entries whose label is no longer a slot under Other, after the slots', () => {
    const groups = groupEntriesBySlot([entry(1, 'Elevenses'), entry(2, 'Breakfast')], ['Breakfast'])
    expect(groups.map((g) => g.label)).toEqual(['Breakfast', 'Other'])
    expect(groups[1].kind).toBe('other')
    expect(groups[1].entries.map((e) => e.id)).toEqual([1])
  })

  it('puts slot-less entries under Unsorted, last', () => {
    const groups = groupEntriesBySlot([entry(1, null), entry(2, 'Elevenses')], ['Breakfast'])
    expect(groups.map((g) => g.label)).toEqual(['Breakfast', 'Other', 'Unsorted'])
    expect(groups[2].kind).toBe('unsorted')
    expect(groups[2].entries.map((e) => e.id)).toEqual([1])
  })

  it('omits Other and Unsorted when they would be empty', () => {
    const groups = groupEntriesBySlot([entry(1, 'Breakfast')], ['Breakfast'])
    expect(groups.map((g) => g.label)).toEqual(['Breakfast'])
  })

  it('never drops entries when the slot list is empty', () => {
    const groups = groupEntriesBySlot([entry(1, null), entry(2, 'Lunch')], [])
    expect(groups.flatMap((g) => g.entries.map((e) => e.id)).sort()).toEqual([1, 2])
  })

  it('keeps a renamed slot label on past entries (shown under Other), never rewriting it', () => {
    const groups = groupEntriesBySlot([entry(1, 'Lunch')], ['Midday'])
    const other = groups.find((g) => g.kind === 'other')!
    expect(other.entries[0].mealSlot).toBe('Lunch')
  })
})
