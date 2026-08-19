import { create } from 'zustand'
import type { DailyLog, FoodLogEntry, Macros } from '@/types/FoodLogEntry'
import { round2 } from '@/utils/number'

const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

// Sum the five frozen macros across entries. The Daily Log total is always derived, never stored.
export function sumMacros(entries: FoodLogEntry[]): Macros {
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

type FoodLogStore = {
  // The calendar day the loaded entries belong to (YYYY-MM-DD), or null before first load.
  logDate: string | null
  entries: FoodLogEntry[]
  setDailyLog: (log: DailyLog) => void
  addEntry: (entry: FoodLogEntry) => void
  getTotal: () => Macros
}

export const useFoodLogStore = create<FoodLogStore>((set, get) => ({
  logDate: null,
  entries: [],
  setDailyLog: (log: DailyLog) => set({ logDate: log.logDate, entries: log.entries }),
  addEntry: (entry: FoodLogEntry) => set((state) => ({ entries: [...state.entries, entry] })),
  getTotal: () => sumMacros(get().entries),
}))

// Reset helper used by tests to isolate store state between cases.
export function resetFoodLogStore() {
  useFoodLogStore.setState({ logDate: null, entries: [] })
}
