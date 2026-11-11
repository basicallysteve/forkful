import type { Macros } from '@/types/FoodLogEntry'
import { round2 } from '@/utils/number'

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

// Sum the five frozen macros across entries, rounding to the numeric(10,2) scale. The canonical
// implementation shared by the server data layer and the client store so their totals can't drift.
export function sumMacros(entries: Macros[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({
      calories: round2(acc.calories + e.calories),
      protein: round2(acc.protein + e.protein),
      carbs: round2(acc.carbs + e.carbs),
      fat: round2(acc.fat + e.fat),
      fiber: round2(acc.fiber + e.fiber),
    }),
    { ...ZERO_MACROS }
  )
}
