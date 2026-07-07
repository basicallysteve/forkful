import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { foods, shoppingListItems, shoppingLists } from '@/db/schema'
import { getFoodById } from '@/lib/foods'
import { EACH_UNIT } from '@/utils/unitConversion'
import type { Food, Measurement } from '@/types/Food'
import type { ShoppingList, ShoppingListItem, ShoppingListItemSourceType } from '@/types/ShoppingList'

const POSTGRES_UNIQUE_VIOLATION = '23505'

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
    saturatedFat: row.saturatedFat != null ? Number(row.saturatedFat) : undefined,
    sugar: row.sugar != null ? Number(row.sugar) : undefined,
    sodium: row.sodium != null ? Number(row.sodium) : undefined,
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? 'g',
    measurements: parseMeasurements(row.measurements),
    density: row.density != null ? Number(row.density) : undefined,
    externalId: row.externalId ?? undefined,
    source: row.source ?? 'manual',
  }
}

function mapShoppingList(row: typeof shoppingLists.$inferSelect): ShoppingList {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    dateAdded: row.dateAdded ?? new Date(),
  }
}

function mapShoppingListItem(
  row: typeof shoppingListItems.$inferSelect,
  food: Food
): ShoppingListItem {
  return {
    id: row.id,
    sourceType: row.sourceType as ShoppingListItemSourceType,
    status: row.status,
    food,
    amount: Number(row.amount),
    unit: row.unit,
    addedDate: row.dateAdded ?? new Date(),
  }
}

function getAllowedFoodUnits(food: Food): string[] {
  const units = food.measurements.map((measurement) => measurement.unit)
  const foodUnits = units.length > 0 ? units : food.servingUnit ? [food.servingUnit] : []
  // The synthetic Each Count Unit is always a valid shopping unit even though it is never part of a
  // Food's Measurements (see ADR-0022).
  return [...foodUnits, EACH_UNIT]
}

async function getActiveShoppingList(userId: number): Promise<ShoppingList | null> {
  const [row] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active')))

  return row ? mapShoppingList(row) : null
}

async function getShoppingListItemById(id: number, userId: number): Promise<ShoppingListItem | null> {
  const [row] = await db
    .select()
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .innerJoin(foods, eq(shoppingListItems.foodId, foods.id))
    .where(and(
      eq(shoppingListItems.id, id),
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
      isNull(foods.dateDeleted),
    ))

  if (!row) return null

  return mapShoppingListItem(row.shopping_list_items, mapFoodRow(row.foods))
}

export async function getOrCreateActiveShoppingList(userId: number): Promise<ShoppingList> {
  const existing = await getActiveShoppingList(userId)
  if (existing) return existing

  try {
    const [created] = await db
      .insert(shoppingLists)
      .values({ userId, status: 'active' })
      .returning()

    return mapShoppingList(created)
  } catch (error) {
    if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
      const createdByAnotherRequest = await getActiveShoppingList(userId)
      if (createdByAnotherRequest) return createdByAnotherRequest
    }
    throw error
  }
}

export async function getShoppingListItems(userId: number): Promise<ShoppingListItem[]> {
  const rows = await db
    .select()
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .innerJoin(foods, eq(shoppingListItems.foodId, foods.id))
    .where(and(
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
      isNull(foods.dateDeleted),
    ))
    .orderBy(asc(shoppingListItems.dateAdded), asc(shoppingListItems.id))

  return rows.map((row) => mapShoppingListItem(row.shopping_list_items, mapFoodRow(row.foods)))
}

export type CreateShoppingListFoodItemData = {
  userId: number
  foodId: number
  amount: number
  unit: string
}

export async function createShoppingListFoodItem(data: CreateShoppingListFoodItemData): Promise<ShoppingListItem> {
  if (data.amount <= 0) throw new Error('Amount must be greater than zero')

  const [shoppingList, food] = await Promise.all([
    getOrCreateActiveShoppingList(data.userId),
    getFoodById(data.foodId),
  ])

  if (!food) throw new Error('Food not found')

  const allowedUnits = getAllowedFoodUnits(food)
  if (!allowedUnits.includes(data.unit)) {
    throw new Error('Unit is not valid for this food')
  }

  // Merge into an existing open (to_buy) line for the same Food + unit rather than creating a
  // duplicate. A different unit, or an already-bought line, stays separate. The whole read-then-write
  // runs in a transaction that locks the parent list row, so two concurrent adds of the same
  // Food + unit cannot both miss the existing line and insert duplicates.
  const itemId = await db.transaction(async (tx) => {
    await tx
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, shoppingList.id))
      .for('update')

    const [existing] = await tx
      .select()
      .from(shoppingListItems)
      .where(and(
        eq(shoppingListItems.shoppingListId, shoppingList.id),
        eq(shoppingListItems.foodId, food.id),
        eq(shoppingListItems.unit, data.unit),
        eq(shoppingListItems.status, 'to_buy'),
      ))

    if (existing) {
      const [updated] = await tx
        .update(shoppingListItems)
        // numeric(10,2): round the merged total to 2 decimals so we never persist a
        // floating-point artifact like "0.30000000000000004".
        .set({ amount: (Number(existing.amount) + data.amount).toFixed(2) })
        .where(eq(shoppingListItems.id, existing.id))
        .returning()
      return updated.id
    }

    const [row] = await tx
      .insert(shoppingListItems)
      .values({
        shoppingListId: shoppingList.id,
        sourceType: 'food',
        foodId: food.id,
        amount: data.amount.toFixed(2),
        unit: data.unit,
        status: 'to_buy',
      })
      .returning()
    return row.id
  })

  const item = await getShoppingListItemById(itemId, data.userId)
  if (!item) throw new Error('Failed to create shopping list item')
  return item
}
