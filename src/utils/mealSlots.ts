import type { FoodLogEntry } from '@/types/FoodLogEntry'

export type MealSlotGroup = {
  // 'slot' = one of the User's current Meal Slots; 'other' = entries whose label is no longer in the
  // set; 'unsorted' = entries logged with no slot (see CONTEXT.md, Meal Slot).
  kind: 'slot' | 'other' | 'unsorted'
  label: string
  entries: FoodLogEntry[]
}

/**
 * Group a day's entries for the Daily Log: one group per current slot in the User's configured order
 * (kept even when empty so each can offer "+ Log food"), then "Other" for stale labels, then "Unsorted"
 * for slot-less entries. Other and Unsorted only appear when they have entries. Entries keep their
 * stored `mealSlot` untouched: renaming or removing a slot never rewrites past entries.
 */
export function groupEntriesBySlot(entries: FoodLogEntry[], slots: string[]): MealSlotGroup[] {
  const known = new Set(slots)
  const groups: MealSlotGroup[] = slots.map((label) => ({
    kind: 'slot',
    label,
    entries: entries.filter((e) => e.mealSlot === label),
  }))
  const other = entries.filter((e) => e.mealSlot != null && !known.has(e.mealSlot))
  const unsorted = entries.filter((e) => e.mealSlot == null)
  if (other.length > 0) groups.push({ kind: 'other', label: 'Other', entries: other })
  if (unsorted.length > 0) groups.push({ kind: 'unsorted', label: 'Unsorted', entries: unsorted })
  return groups
}
