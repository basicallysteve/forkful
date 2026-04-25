import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'

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
    servingUnit: row.servingUnit ?? undefined,
    measurements: (row.measurements as string[] | null) ?? [],
  }
}

export async function getFoods(): Promise<Food[]> {
  try {
    const rows = await db.select().from(foods)
    return rows.map(mapFood)
  } catch {
    return []
  }
}

export async function getFoodBySlug(slug: string): Promise<Food | null> {
  const rows = await db.select().from(foods)
  const row = rows.find((f) => toSlug(f.name) === slug)
  return row ? mapFood(row) : null
}

export async function getFoodById(id: number): Promise<Food | null> {
  const [row] = await db.select().from(foods).where(eq(foods.id, id))
  return row ? mapFood(row) : null
}

export async function createFood(data: Omit<Food, 'id'>): Promise<Food> {
  const [row] = await db.insert(foods).values({
    name: data.name,
    calories: data.calories,
    protein: String(data.protein ?? 0),
    carbs: String(data.carbs ?? 0),
    fat: String(data.fat ?? 0),
    fiber: String(data.fiber ?? 0),
    servingSize: String(data.servingSize ?? 1),
    servingUnit: data.servingUnit,
    measurements: data.measurements ?? [],
  }).returning()
  return mapFood(row)
}

export async function updateFood(id: number, data: Partial<Omit<Food, 'id'>>): Promise<Food | null> {
  const updates: Partial<typeof foods.$inferInsert> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.calories !== undefined) updates.calories = data.calories
  if (data.protein !== undefined) updates.protein = String(data.protein)
  if (data.carbs !== undefined) updates.carbs = String(data.carbs)
  if (data.fat !== undefined) updates.fat = String(data.fat)
  if (data.fiber !== undefined) updates.fiber = String(data.fiber)
  if (data.servingSize !== undefined) updates.servingSize = String(data.servingSize)
  if (data.servingUnit !== undefined) updates.servingUnit = data.servingUnit
  if (data.measurements !== undefined) updates.measurements = data.measurements
  const [row] = await db.update(foods).set(updates).where(eq(foods.id, id)).returning()
  return row ? mapFood(row) : null
}

export async function deleteFood(id: number): Promise<boolean> {
  const deleted = await db.delete(foods).where(eq(foods.id, id)).returning()
  return deleted.length > 0
}
