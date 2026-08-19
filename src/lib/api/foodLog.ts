import type { DailyLog, FoodLogEntry } from '@/types/FoodLogEntry'

type RawFoodLogEntry = Omit<FoodLogEntry, 'dateAdded'> & { dateAdded: string }
type RawDailyLog = Omit<DailyLog, 'entries'> & { entries: RawFoodLogEntry[] }

function parseEntry(raw: RawFoodLogEntry): FoodLogEntry {
  return { ...raw, dateAdded: new Date(raw.dateAdded) }
}

export type CreateFoodLogEntryData = {
  foodId: number
  amount: number
  unit: string
  logDate: string
}

// Fetch the Daily Log for a user-local day. `logDate` is the client-derived YYYY-MM-DD (never UTC).
export async function apiFetchDailyLog(logDate: string): Promise<DailyLog> {
  const res = await fetch(`/api/log?date=${encodeURIComponent(logDate)}`)
  if (!res.ok) throw new Error('Failed to fetch daily log')
  const raw: RawDailyLog = await res.json()
  return { ...raw, entries: raw.entries.map(parseEntry) }
}

export async function apiCreateFoodLogEntry(data: CreateFoodLogEntryData): Promise<FoodLogEntry> {
  const res = await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create food log entry')
  const raw: RawFoodLogEntry = await res.json()
  return parseEntry(raw)
}
