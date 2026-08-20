import { create } from 'zustand'
import type { DailyLog, FoodLogEntry, Macros } from '@/types/FoodLogEntry'
// Re-exported so existing consumers (the Log view, tests) keep importing `sumMacros` from the store,
// while the one canonical implementation lives in a db-free util shared with the server data layer.
import { sumMacros } from '@/utils/macros'

export { sumMacros }

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
