import { eq, and, isNull, asc } from 'drizzle-orm'
import { db } from '@/db'
import { foodLogEntries, foods } from '@/db/schema'
import type { Food, Measurement } from '@/types/Food'
import type { DailyLog, FoodLogEntry, Macros } from '@/types/FoodLogEntry'
import { servingScaleFactor } from '@/utils/unitConversion'
import { round2 } from '@/utils/number'

function parseMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return []
  return raw.map((m) => (typeof m === 'string' ? { unit: m } : m as Measurement))
}

function mapFood(row: typeof foods.$inferSelect): Food {
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? 'g',
    measurements: parseMeasurements(row.measurements),
    density: row.density != null ? Number(row.density) : undefined,
  }
}

function mapEntry(row: typeof foodLogEntries.$inferSelect, food: Food | null): FoodLogEntry {
  return {
    id: row.id,
    sourceType: row.sourceType,
    foodId: row.foodId ?? null,
    food,
    amount: Number(row.amount),
    unit: row.unit ?? null,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    fiber: Number(row.fiber),
    logDate: row.logDate,
    dateAdded: row.dateAdded,
  }
}

const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

/**
 * Compute the five frozen macros for logging `amount` of `unit` of a Food, by scaling the Food's
 * per-serving nutrition uniformly (see ADR-0025 Decision 2). Returns all-zero macros when the amount
 * can't be resolved to the Food's serving unit — logging never blocks on an uncalibrated unit, it
 * records zero (the flow is expected to offer calibration before reaching this point).
 */
export function computeFrozenMacros(food: Food, amount: number, unit: string): Macros {
  const gramsPerUnit = food.measurements.find((m) => m.unit === unit)?.gramsPerUnit
  const factor = servingScaleFactor({
    baseServingSize: food.servingSize,
    baseServingUnit: food.servingUnit,
    targetAmount: amount,
    targetUnit: unit,
    gramsPerUnit,
    density: food.density,
  })
  if (factor === null) return { ...ZERO_MACROS }
  return {
    calories: round2(food.calories * factor),
    protein: round2(food.protein * factor),
    carbs: round2(food.carbs * factor),
    fat: round2(food.fat * factor),
    fiber: round2(food.fiber * factor),
  }
}

export type CreateFoodLogEntryData = {
  userId: number
  foodId: number
  amount: number
  unit: string
  // The user-local calendar day (YYYY-MM-DD), derived on the client and sent with the write.
  logDate: string
}

export async function createFoodLogEntry(data: CreateFoodLogEntryData): Promise<FoodLogEntry> {
  const [foodRow] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, data.foodId), isNull(foods.dateDeleted)))
  if (!foodRow) throw new Error('Food not found')

  const food = mapFood(foodRow)
  const macros = computeFrozenMacros(food, data.amount, data.unit)

  const [row] = await db
    .insert(foodLogEntries)
    .values({
      userId: data.userId,
      sourceType: 'food',
      foodId: data.foodId,
      amount: String(data.amount),
      unit: data.unit,
      calories: String(macros.calories),
      protein: String(macros.protein),
      carbs: String(macros.carbs),
      fat: String(macros.fat),
      fiber: String(macros.fiber),
      logDate: data.logDate,
    })
    .returning()

  return mapEntry(row, food)
}

function sumMacros(entries: FoodLogEntry[]): Macros {
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

/**
 * The Daily Log for a single user-local day — a derived view (no daily_logs table). Returns the day's
 * live (non-deleted) entries oldest-first plus their summed macro total, computed on the fly from each
 * entry's frozen macros.
 */
export async function getDailyLog(userId: number, logDate: string): Promise<DailyLog> {
  const rows = await db
    .select()
    .from(foodLogEntries)
    .leftJoin(foods, eq(foodLogEntries.foodId, foods.id))
    .where(and(
      eq(foodLogEntries.userId, userId),
      eq(foodLogEntries.logDate, logDate),
      isNull(foodLogEntries.dateDeleted),
    ))
    .orderBy(asc(foodLogEntries.dateAdded), asc(foodLogEntries.id))

  const entries = rows.map((r) => mapEntry(r.food_log_entries, r.foods ? mapFood(r.foods) : null))
  return { logDate, entries, total: sumMacros(entries) }
}
