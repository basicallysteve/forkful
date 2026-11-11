import type { Food } from './Food'

// The referent discriminator. Only 'food' is produced in the current slice; the wider union matches
// the DB enum so later slices (Product, Prepared Meal) need no type change here.
export type FoodLogSourceType = 'food' | 'product' | 'prepared_meal'

// The five core macros snapshotted onto every Food Log Entry (see ADR-0025 Decision 2).
export type Macros = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export type FoodLogEntry = Macros & {
  id: number
  sourceType: FoodLogSourceType
  foodId: number | null
  // The referent Food, resolved for display. Null when the referent has been deleted — the entry
  // still stands on its frozen macros.
  food: Food | null
  amount: number
  unit: string | null
  // The user-local calendar day, as a YYYY-MM-DD string (never a Date — it carries no time-of-day).
  logDate: string
  dateAdded: Date
}

// The Daily Log is a derived view, not a stored entity: a day's entries plus their summed macro total.
export type DailyLog = {
  logDate: string
  entries: FoodLogEntry[]
  total: Macros
}
