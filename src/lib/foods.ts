import { eq, isNull, and, ilike, asc, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import type { Food, FoodSource, Measurement } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export type FoodQueryOptions = {
  search?: string
  sortBy?: 'name' | 'calories' | 'protein'
  sortDir?: 'asc' | 'desc'
}

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
    saturatedFat: row.saturatedFat != null ? Number(row.saturatedFat) : undefined,
    sugar: row.sugar != null ? Number(row.sugar) : undefined,
    sodium: row.sodium != null ? Number(row.sodium) : undefined,
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? 'g',
    measurements: parseMeasurements(row.measurements),
    externalId: row.externalId ?? undefined,
    source: (row.source as FoodSource) ?? 'manual',
  }
}

export async function getFoods(options: FoodQueryOptions = {}): Promise<Food[]> {
  try {
    const where = options.search
      ? and(isNull(foods.dateDeleted), ilike(foods.name, `%${options.search}%`))
      : isNull(foods.dateDeleted)

    const orderBy = (() => {
      if (options.search) {
        const term = options.search
        // Exact match → starts-with → contains, then alphabetical within each tier
        return [
          sql`CASE
            WHEN ${foods.name} ILIKE ${term}                          THEN 0
            WHEN SPLIT_PART(${foods.name}, ',', 1) ILIKE ${term + '%'} THEN 1
            WHEN ${foods.name} ILIKE ${term + '%'}                    THEN 2
            ELSE 3
          END`,
          asc(foods.name),
        ]
      }
      if (options.sortBy === 'calories') return [options.sortDir === 'desc' ? desc(foods.calories) : asc(foods.calories)]
      if (options.sortBy === 'protein') return [options.sortDir === 'desc' ? desc(foods.protein) : asc(foods.protein)]
      return [options.sortDir === 'desc' ? desc(foods.name) : asc(foods.name)]
    })()

    const rows = await db.select().from(foods).where(where).orderBy(...orderBy)
    return rows.map(mapFood)
  } catch {
    return []
  }
}

export async function getFoodBySlug(slug: string): Promise<Food | null> {
  const [row] = await db.select().from(foods).where(and(eq(foods.slug, slug), isNull(foods.dateDeleted)))
  return row ? mapFood(row) : null
}

export async function getFoodById(id: number): Promise<Food | null> {
  const [row] = await db.select().from(foods).where(and(eq(foods.id, id), isNull(foods.dateDeleted)))
  return row ? mapFood(row) : null
}

export async function getFoodByExternalId(externalId: string): Promise<Food | null> {
  const [row] = await db.select().from(foods).where(and(eq(foods.externalId, externalId), isNull(foods.dateDeleted)))
  return row ? mapFood(row) : null
}

export async function createFood(data: Omit<Food, 'id'>): Promise<Food> {
  const [row] = await db.insert(foods).values({
    name: data.name,
    slug: toSlug(data.name),
    calories: data.calories,
    protein: String(data.protein ?? 0),
    carbs: String(data.carbs ?? 0),
    fat: String(data.fat ?? 0),
    fiber: String(data.fiber ?? 0),
    servingSize: String(data.servingSize ?? 1),
    servingUnit: data.servingUnit,
    measurements: data.measurements ?? [],
    saturatedFat: data.saturatedFat != null ? String(data.saturatedFat) : null,
    sugar: data.sugar != null ? String(data.sugar) : null,
    sodium: data.sodium != null ? String(data.sodium) : null,
    externalId: data.externalId ?? null,
    source: data.source ?? 'manual',
  }).returning()
  return mapFood(row)
}

const NUTRITIONAL_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'saturatedFat', 'sugar', 'sodium'] as const

export async function updateFood(id: number, data: Partial<Omit<Food, 'id'>>): Promise<Food | null> {
  const [existing] = await db.select().from(foods).where(eq(foods.id, id))

  const updates: Partial<typeof foods.$inferInsert> = {}
  if (data.name !== undefined) {
    updates.name = data.name
    updates.slug = toSlug(data.name)
  }
  if (data.calories !== undefined) updates.calories = data.calories
  if (data.protein !== undefined) updates.protein = String(data.protein)
  if (data.carbs !== undefined) updates.carbs = String(data.carbs)
  if (data.fat !== undefined) updates.fat = String(data.fat)
  if (data.fiber !== undefined) updates.fiber = String(data.fiber)
  if (data.servingSize !== undefined) updates.servingSize = String(data.servingSize)
  if (data.servingUnit !== undefined) updates.servingUnit = data.servingUnit
  if (data.measurements !== undefined) updates.measurements = data.measurements
  if (data.saturatedFat !== undefined) updates.saturatedFat = data.saturatedFat != null ? String(data.saturatedFat) : null
  if (data.sugar !== undefined) updates.sugar = data.sugar != null ? String(data.sugar) : null
  if (data.sodium !== undefined) updates.sodium = data.sodium != null ? String(data.sodium) : null
  if (data.externalId !== undefined) updates.externalId = data.externalId ?? null

  if (existing?.source === 'open_food_facts') {
    const current = mapFood(existing)
    const nutritionChanged = NUTRITIONAL_FIELDS.some(
      (field) => field in data && data[field] !== current[field]
    )
    if (nutritionChanged) updates.source = 'manual'
  }

  const [row] = await db.update(foods).set(updates).where(eq(foods.id, id)).returning()
  return row ? mapFood(row) : null
}

export async function deleteFood(id: number): Promise<boolean> {
  const deleted = await db.delete(foods).where(eq(foods.id, id)).returning()
  return deleted.length > 0
}
