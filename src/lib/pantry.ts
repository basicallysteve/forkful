import { eq, isNull, isNotNull, and, or, inArray, lte, gt, asc, desc, ilike, sql } from 'drizzle-orm'
import { db } from '@/db'
import { pantryItems, foods } from '@/db/schema'
import type { PantryItem, PantryItemStatus } from '@/types/PantryItem'
import type { Food } from '@/types/Food'
import { calculatePantryStatus } from '@/utils/pantryStatus'

const EXPIRING_SOON_THRESHOLD_DAYS = 7

export type PantryQueryOptions = {
  search?: string
  status?: 'all' | PantryItemStatus
  sortBy?: 'name' | 'expirationDate' | 'addedDate' | 'status'
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
    status: calculatePantryStatus(expirationDate),
    frozenDate: row.frozenDate ? new Date(row.frozenDate) : null,
  }
}

export async function getPantryItems(userId: number, options: PantryQueryOptions = {}): Promise<PantryItem[]> {
  try {
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_THRESHOLD_DAYS)

    const statusFilter = (() => {
      switch (options.status) {
        case 'expired':
          return and(isNotNull(pantryItems.expirationDate), lte(pantryItems.expirationDate, now))
        case 'expiring-soon':
          return and(
            isNotNull(pantryItems.expirationDate),
            gt(pantryItems.expirationDate, now),
            lte(pantryItems.expirationDate, cutoff)
          )
        case 'good':
          return or(isNull(pantryItems.expirationDate), gt(pantryItems.expirationDate, cutoff))
        default:
          return undefined
      }
    })()

    const searchFilter = options.search
      ? ilike(foods.name, `%${options.search}%`)
      : undefined

    const dir = options.sortDir === 'desc' ? 'DESC' : 'ASC'
    const orderBy = (() => {
      switch (options.sortBy) {
        case 'name':
          return options.sortDir === 'desc' ? desc(foods.name) : asc(foods.name)
        case 'addedDate':
          return options.sortDir === 'desc' ? desc(pantryItems.addedDate) : asc(pantryItems.addedDate)
        case 'expirationDate':
        case 'status':
        default:
          // nulls last so items with no expiration date (status=good) sort after dated items
          return sql`${pantryItems.expirationDate} ${sql.raw(dir)} NULLS LAST`
      }
    })()

    const rows = await db
      .select()
      .from(pantryItems)
      .innerJoin(foods, eq(pantryItems.foodId, foods.id))
      .where(
        and(
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
          isNull(foods.dateDeleted),
          statusFilter,
          searchFilter,
        )
      )
      .orderBy(orderBy)
    return rows.map(row => mapPantryItem(row.pantry_items, mapFood(row.foods)))
  } catch (err) {
    console.error('getPantryItems failed:', err)
    return []
  }
}

export async function getExpiringPantryItems(userId: number, limit = 5): Promise<PantryItem[]> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_THRESHOLD_DAYS)
    const rows = await db
      .select()
      .from(pantryItems)
      .innerJoin(foods, eq(pantryItems.foodId, foods.id))
      .where(
        and(
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
          isNull(foods.dateDeleted),
          lte(pantryItems.expirationDate, cutoff)
        )
      )
      .orderBy(asc(pantryItems.expirationDate))
      .limit(limit)
    return rows.map(row => mapPantryItem(row.pantry_items, mapFood(row.foods)))
  } catch {
    return []
  }
}

export async function getPantryItemById(id: number, userId: number): Promise<PantryItem | null> {
  try {
    const [row] = await db
      .select()
      .from(pantryItems)
      .innerJoin(foods, eq(pantryItems.foodId, foods.id))
      .where(
        and(
          eq(pantryItems.id, id),
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
          isNull(foods.dateDeleted)
        )
      )
    if (!row) return null
    return mapPantryItem(row.pantry_items, mapFood(row.foods))
  } catch (err) {
    console.error('getPantryItemById failed:', err)
    return null
  }
}

export type CreatePantryItemData = {
  userId: number
  foodId: number
  expirationDate?: Date | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

export async function createPantryItem(data: CreatePantryItemData): Promise<PantryItem> {
  const [row] = await db.insert(pantryItems).values({
    userId: data.userId,
    foodId: data.foodId,
    expirationDate: data.expirationDate ?? null,
    originalSizeAmount: String(data.originalSizeAmount),
    originalSizeUnit: data.originalSizeUnit,
    currentSizeAmount: String(data.currentSizeAmount),
    currentSizeUnit: data.currentSizeUnit,
  }).returning()
  const item = await getPantryItemById(row.id, data.userId)
  if (!item) throw new Error('Failed to create pantry item')
  return item
}

export type UpdatePantryItemData = Partial<Omit<CreatePantryItemData, 'userId' | 'foodId'>> & {
  frozenDate?: Date | null
}

export async function updatePantryItem(id: number, userId: number, data: UpdatePantryItemData): Promise<PantryItem | null> {
  const updates: Partial<typeof pantryItems.$inferInsert> = {}
  if (data.expirationDate !== undefined) updates.expirationDate = data.expirationDate ?? null
  if (data.originalSizeAmount !== undefined) updates.originalSizeAmount = String(data.originalSizeAmount)
  if (data.originalSizeUnit !== undefined) updates.originalSizeUnit = data.originalSizeUnit
  if (data.currentSizeAmount !== undefined) updates.currentSizeAmount = String(data.currentSizeAmount)
  if (data.currentSizeUnit !== undefined) updates.currentSizeUnit = data.currentSizeUnit
  if (data.frozenDate !== undefined) updates.frozenDate = data.frozenDate ?? null
  if (Object.keys(updates).length === 0) return getPantryItemById(id, userId)
  await db.update(pantryItems).set(updates).where(
    and(eq(pantryItems.id, id), eq(pantryItems.userId, userId))
  )
  return getPantryItemById(id, userId)
}

export async function deletePantryItem(id: number, userId: number): Promise<boolean> {
  const updated = await db
    .update(pantryItems)
    .set({ dateDeleted: new Date() })
    .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
    .returning()
  return updated.length > 0
}

export async function deletePantryItems(ids: number[], userId: number): Promise<number[]> {
  if (ids.length === 0) return []
  const updated = await db
    .update(pantryItems)
    .set({ dateDeleted: new Date() })
    .where(and(inArray(pantryItems.id, ids), eq(pantryItems.userId, userId)))
    .returning()
  return updated.map(item => item.id)
}
