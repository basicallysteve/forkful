import { eq, isNull, and } from 'drizzle-orm'
import { db } from '@/db'
import { pantryItems, foods } from '@/db/schema'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

// ms → s → min → hr → day
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const EXPIRING_SOON_THRESHOLD_DAYS = 7

function calculateStatus(expirationDate: Date | null): PantryItem['status'] {
  if (!expirationDate) return 'good'
  const now = new Date()
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / MILLISECONDS_PER_DAY)
  if (daysUntilExpiration < 0) return 'expired'
  if (daysUntilExpiration <= EXPIRING_SOON_THRESHOLD_DAYS) return 'expiring-soon'
  return 'good'
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
    servingUnit: row.servingUnit ?? undefined,
    measurements: (row.measurements as string[] | null) ?? [],
  }
}

function mapPantryItem(row: typeof pantryItems.$inferSelect, food: Food): PantryItem {
  const expirationDate = row.expirationDate ? new Date(row.expirationDate) : null
  return {
    id: row.id,
    food,
    expirationDate,
    originalSize: {
      size: Number(row.originalSizeAmount),
      unit: row.originalSizeUnit ?? undefined,
    },
    currentSize: {
      size: Number(row.currentSizeAmount),
      unit: row.currentSizeUnit ?? undefined,
    },
    addedDate: row.addedDate ? new Date(row.addedDate) : new Date(),
    status: calculateStatus(expirationDate),
    frozenDate: row.frozenDate ? new Date(row.frozenDate) : null,
  }
}

export async function getPantryItems(): Promise<PantryItem[]> {
  try {
    const rows = await db
      .select()
      .from(pantryItems)
      .innerJoin(foods, eq(pantryItems.foodId, foods.id))
      .where(
        and(
          isNull(pantryItems.dateDeleted),
          isNull(foods.dateDeleted)
        )
      )
    return rows.map(row => mapPantryItem(row.pantry_items, mapFood(row.foods)))
  } catch {
    return []
  }
}

export async function getPantryItemById(id: number): Promise<PantryItem | null> {
  try {
    const [row] = await db
      .select()
      .from(pantryItems)
      .innerJoin(foods, eq(pantryItems.foodId, foods.id))
      .where(
        and(
          eq(pantryItems.id, id),
          isNull(pantryItems.dateDeleted),
          isNull(foods.dateDeleted)
        )
      )
    if (!row) return null
    return mapPantryItem(row.pantry_items, mapFood(row.foods))
  } catch {
    return null
  }
}

export type CreatePantryItemData = {
  foodId: number
  expirationDate?: Date | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

export async function createPantryItem(data: CreatePantryItemData): Promise<PantryItem> {
  const [row] = await db.insert(pantryItems).values({
    foodId: data.foodId,
    expirationDate: data.expirationDate ?? null,
    originalSizeAmount: String(data.originalSizeAmount),
    originalSizeUnit: data.originalSizeUnit,
    currentSizeAmount: String(data.currentSizeAmount),
    currentSizeUnit: data.currentSizeUnit,
  }).returning()
  const item = await getPantryItemById(row.id)
  if (!item) throw new Error('Failed to create pantry item')
  return item
}

export type UpdatePantryItemData = Partial<Omit<CreatePantryItemData, 'foodId'>> & {
  frozenDate?: Date | null
}

export async function updatePantryItem(id: number, data: UpdatePantryItemData): Promise<PantryItem | null> {
  const updates: Partial<typeof pantryItems.$inferInsert> = {}
  if (data.expirationDate !== undefined) updates.expirationDate = data.expirationDate ?? null
  if (data.originalSizeAmount !== undefined) updates.originalSizeAmount = String(data.originalSizeAmount)
  if (data.originalSizeUnit !== undefined) updates.originalSizeUnit = data.originalSizeUnit
  if (data.currentSizeAmount !== undefined) updates.currentSizeAmount = String(data.currentSizeAmount)
  if (data.currentSizeUnit !== undefined) updates.currentSizeUnit = data.currentSizeUnit
  if (data.frozenDate !== undefined) updates.frozenDate = data.frozenDate ?? null
  await db.update(pantryItems).set(updates).where(eq(pantryItems.id, id))
  return getPantryItemById(id)
}

export async function deletePantryItem(id: number): Promise<boolean> {
  const updated = await db.update(pantryItems).set({ dateDeleted: new Date() }).where(eq(pantryItems.id, id)).returning()
  return updated.length > 0
}
