import { eq, isNull, and } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import type { Food, FoodSource } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export type FoodQueryOptions = {
  search?: string
  sortBy?: 'name' | 'calories' | 'protein'
  sortDir?: 'asc' | 'desc'
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
    servingUnit: row.servingUnit ?? undefined,
    measurements: (row.measurements as string[] | null) ?? [],
    barcode: row.barcode ?? undefined,
    source: (row.source as FoodSource) ?? 'manual',
  }
}

export async function getFoods(options: FoodQueryOptions = {}): Promise<Food[]> {
  try {
    let rows = await db.select().from(foods).where(isNull(foods.dateDeleted))
    if (options.search) {
      const term = options.search.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(term))
    }
    if (options.sortBy) {
      rows = rows.sort((a, b) => {
        let cmp = 0
        if (options.sortBy === 'name') cmp = a.name.localeCompare(b.name)
        else if (options.sortBy === 'calories') cmp = a.calories - b.calories
        else if (options.sortBy === 'protein') cmp = Number(a.protein ?? 0) - Number(b.protein ?? 0)
        return options.sortDir === 'desc' ? -cmp : cmp
      })
    }
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
    barcode: data.barcode ?? null,
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
  if (data.barcode !== undefined) updates.barcode = data.barcode ?? null

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

export async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  const [row] = await db.select().from(foods).where(and(eq(foods.barcode, barcode), isNull(foods.dateDeleted)))
  return row ? mapFood(row) : null
}

export async function deleteFood(id: number): Promise<boolean> {
  const deleted = await db.delete(foods).where(eq(foods.id, id)).returning()
  return deleted.length > 0
}
