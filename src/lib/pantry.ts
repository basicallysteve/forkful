import { eq, isNull, isNotNull, and, or, inArray, lte, gt, asc, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { pantryItems, foods, products } from '@/db/schema'
import type { PantryItem, PantryItemStatus } from '@/types/PantryItem'
import type { Food, Measurement } from '@/types/Food'
import type { Product } from '@/types/Product'
import { calculatePantryStatus } from '@/utils/pantryStatus'

const EXPIRING_SOON_THRESHOLD_DAYS = 7

export type PantryQueryOptions = {
  search?: string
  status?: 'all' | PantryItemStatus
  sortBy?: 'name' | 'expirationDate' | 'addedDate' | 'status'
  sortDir?: 'asc' | 'desc'
}

function parseMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return []
  return raw.map((m) => (typeof m === 'string' ? { unit: m } : m as Measurement))
}

function mapFoodRow(row: typeof foods.$inferSelect): Food {
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
  }
}

function mapProductRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode ?? undefined,
    externalId: row.externalId ?? undefined,
    parentFoodId: row.parentFoodId ?? undefined,
    calories: row.calories,
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? 'g',
    measurements: parseMeasurements(row.measurements),
  }
}

function mapPantryItem(
  row: typeof pantryItems.$inferSelect,
  food?: Food,
  product?: Product
): PantryItem {
  const expirationDate = row.expirationDate ? new Date(row.expirationDate) : null
  const sourceType = (row.sourceType as 'food' | 'product') ?? 'food'
  return {
    id: row.id,
    sourceType,
    food,
    product,
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

/** Resolve a display name from a pantry item row (for search filter). */
function getItemName(food?: Food, product?: Product): string {
  return food?.name ?? product?.name ?? ''
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

    const dir = options.sortDir === 'desc' ? 'DESC' : 'ASC'
    const orderBy = (() => {
      switch (options.sortBy) {
        case 'addedDate':
          return options.sortDir === 'desc' ? desc(pantryItems.addedDate) : asc(pantryItems.addedDate)
        case 'expirationDate':
        case 'status':
        default:
          return sql`${pantryItems.expirationDate} ${sql.raw(dir)} NULLS LAST`
      }
    })()

    const rows = await db
      .select()
      .from(pantryItems)
      .leftJoin(foods, eq(pantryItems.foodId, foods.id))
      .leftJoin(products, eq(pantryItems.productId, products.id))
      .where(
        and(
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
          statusFilter,
        )
      )
      .orderBy(orderBy)

    let items = rows.map(row => mapPantryItem(
      row.pantry_items,
      row.foods ? mapFoodRow(row.foods) : undefined,
      row.products ? mapProductRow(row.products) : undefined
    ))

    // Apply search filter in-memory (searches across food and product names)
    if (options.search) {
      const term = options.search.toLowerCase()
      items = items.filter(item => getItemName(item.food, item.product).toLowerCase().includes(term))
    }

    // Apply name sort in-memory (since name comes from either foods or products)
    if (options.sortBy === 'name') {
      items.sort((a, b) => {
        const cmp = getItemName(a.food, a.product).localeCompare(getItemName(b.food, b.product))
        return options.sortDir === 'desc' ? -cmp : cmp
      })
    }

    return items
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
      .leftJoin(foods, eq(pantryItems.foodId, foods.id))
      .leftJoin(products, eq(pantryItems.productId, products.id))
      .where(
        and(
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
          lte(pantryItems.expirationDate, cutoff)
        )
      )
      .orderBy(asc(pantryItems.expirationDate))
      .limit(limit)
    return rows.map(row => mapPantryItem(
      row.pantry_items,
      row.foods ? mapFoodRow(row.foods) : undefined,
      row.products ? mapProductRow(row.products) : undefined
    ))
  } catch {
    return []
  }
}

export async function getPantryItemById(id: number, userId: number): Promise<PantryItem | null> {
  try {
    const [row] = await db
      .select()
      .from(pantryItems)
      .leftJoin(foods, eq(pantryItems.foodId, foods.id))
      .leftJoin(products, eq(pantryItems.productId, products.id))
      .where(
        and(
          eq(pantryItems.id, id),
          eq(pantryItems.userId, userId),
          isNull(pantryItems.dateDeleted),
        )
      )
    if (!row) return null
    return mapPantryItem(
      row.pantry_items,
      row.foods ? mapFoodRow(row.foods) : undefined,
      row.products ? mapProductRow(row.products) : undefined
    )
  } catch (err) {
    console.error('getPantryItemById failed:', err)
    return null
  }
}

export type CreatePantryItemData = {
  userId: number
  sourceType?: 'food' | 'product'
  foodId?: number
  productId?: number
  expirationDate?: Date | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

export async function createPantryItem(data: CreatePantryItemData): Promise<PantryItem> {
  const sourceType = data.sourceType ?? (data.foodId ? 'food' : 'product')
  const [row] = await db.insert(pantryItems).values({
    userId: data.userId,
    sourceType,
    foodId: data.foodId ?? null,
    productId: data.productId ?? null,
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

export type UpdatePantryItemData = Partial<Omit<CreatePantryItemData, 'userId' | 'foodId' | 'productId' | 'sourceType'>> & {
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
