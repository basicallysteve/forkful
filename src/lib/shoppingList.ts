import { and, asc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { foods, products, shoppingListItems, shoppingLists } from '@/db/schema'
import { getFoodById } from '@/lib/foods'
import { getProductById } from '@/lib/products'
import { EACH_UNIT } from '@/utils/unitConversion'
import type { Food, Measurement } from '@/types/Food'
import type { Product, ProductSource } from '@/types/Product'
import type { ShoppingList, ShoppingListItem, ShoppingListItemSourceType } from '@/types/ShoppingList'

const POSTGRES_UNIQUE_VIOLATION = '23505'

// Freeform text is user-supplied, so cap it to the shopping_list_items column limits and surface a
// clean validation error rather than letting an over-length value hit the DB as a 500.
const FREEFORM_NAME_MAX_LENGTH = 255
const FREEFORM_UNIT_MAX_LENGTH = 50

// amount is numeric(10, 2): its largest representable value is 99,999,999.99. Reject anything above
// it — including a merge total that would tip an otherwise-valid line over — with a clean validation
// error instead of letting the write overflow the column as a 500.
const AMOUNT_MAX = 99_999_999.99

function assertAmountInRange(amount: number): void {
  if (amount <= 0) throw new Error('Amount must be greater than zero')
  if (amount > AMOUNT_MAX) throw new Error('Amount is too large')
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

function mapProductRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    slug: row.slug ?? undefined,
    name: row.name,
    barcode: row.barcode ?? undefined,
    externalId: row.externalId ?? undefined,
    parentFoodId: row.parentFoodId ?? undefined,
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
    source: (row.source as ProductSource) ?? 'manual',
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
  food?: Food,
  product?: Product
): ShoppingListItem {
  const sourceType = row.sourceType as ShoppingListItemSourceType
  // The display name comes from the linked entity for food/product lines and from the stored free
  // text for freeform lines. The `?? ''` is only a type guard: callers exclude soft-deleted links and
  // food/product rows always have their entity joined, so the fallbacks aren't reached in practice.
  const name = sourceType === 'product'
    ? product?.name ?? ''
    : sourceType === 'freeform'
      ? row.name ?? ''
      : food?.name ?? ''

  return {
    id: row.id,
    sourceType,
    status: row.status,
    name,
    food,
    product,
    amount: Number(row.amount),
    unit: row.unit,
    addedDate: row.dateAdded ?? new Date(),
  }
}

// A line's unit is limited to its source's Measurements (plus the synthetic Each Count Unit, which is
// always valid even though it is never part of a Measurements list — see ADR-0022).
function getAllowedUnits(measurements: Measurement[], servingUnit: string | undefined): string[] {
  const units = measurements.map((measurement) => measurement.unit)
  const base = units.length > 0 ? units : servingUnit ? [servingUnit] : []
  return [...base, EACH_UNIT]
}

async function getActiveShoppingList(userId: number): Promise<ShoppingList | null> {
  const [row] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active')))

  return row ? mapShoppingList(row) : null
}

// A food/product line joins its source row, but a freeform line joins neither, so both joins are
// LEFT and soft-deleted sources are excluded only when the line actually links to one.
const notSoftDeletedSources = and(
  or(isNull(shoppingListItems.foodId), isNull(foods.dateDeleted)),
  or(isNull(shoppingListItems.productId), isNull(products.dateDeleted)),
)

function mapJoinedRow(row: {
  shopping_list_items: typeof shoppingListItems.$inferSelect
  foods: typeof foods.$inferSelect | null
  products: typeof products.$inferSelect | null
}): ShoppingListItem {
  return mapShoppingListItem(
    row.shopping_list_items,
    row.foods ? mapFoodRow(row.foods) : undefined,
    row.products ? mapProductRow(row.products) : undefined,
  )
}

async function getShoppingListItemById(id: number, userId: number): Promise<ShoppingListItem | null> {
  const [row] = await db
    .select()
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .leftJoin(foods, eq(shoppingListItems.foodId, foods.id))
    .leftJoin(products, eq(shoppingListItems.productId, products.id))
    .where(and(
      eq(shoppingListItems.id, id),
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
      notSoftDeletedSources,
    ))

  if (!row) return null

  return mapJoinedRow(row)
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
    .leftJoin(foods, eq(shoppingListItems.foodId, foods.id))
    .leftJoin(products, eq(shoppingListItems.productId, products.id))
    .where(and(
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
      notSoftDeletedSources,
    ))
    .orderBy(asc(shoppingListItems.dateAdded), asc(shoppingListItems.id))

  return rows.map(mapJoinedRow)
}

type ResolvedNewItem = {
  sourceType: ShoppingListItemSourceType
  foodId: number | null
  productId: number | null
  name: string | null
  amount: number
  unit: string | null
}

// Insert a new line, or merge into an existing open (to_buy) line with the same source identity and
// unit. Merging keeps a different unit — or an already-bought line — separate. The whole
// read-then-write runs in a transaction that locks the parent list row, so two concurrent adds of the
// same source + unit cannot both miss the existing line and insert duplicates.
async function insertOrMergeItem(userId: number, values: ResolvedNewItem): Promise<ShoppingListItem> {
  const shoppingList = await getOrCreateActiveShoppingList(userId)

  // A line's identity is its source: the Food, the Product, or the freeform name. Freeform names
  // match case-insensitively, so "Trash bags" and "trash bags" merge (the existing line keeps its
  // original casing). A Food and Product that share a name never merge, because sourceType — and thus
  // the matched column — differs.
  const identityMatch: SQL =
    values.sourceType === 'food' ? eq(shoppingListItems.foodId, values.foodId as number)
      : values.sourceType === 'product' ? eq(shoppingListItems.productId, values.productId as number)
        : sql`lower(${shoppingListItems.name}) = lower(${values.name as string})`

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
        eq(shoppingListItems.sourceType, values.sourceType),
        identityMatch,
        values.unit === null ? isNull(shoppingListItems.unit) : eq(shoppingListItems.unit, values.unit),
        eq(shoppingListItems.status, 'to_buy'),
      ))

    if (existing) {
      const mergedAmount = Number(existing.amount) + values.amount
      // Each add is individually in range, but their sum can still exceed the column ceiling.
      assertAmountInRange(mergedAmount)
      const [updated] = await tx
        .update(shoppingListItems)
        // numeric(10,2): round the merged total to 2 decimals so we never persist a
        // floating-point artifact like "0.30000000000000004".
        .set({ amount: mergedAmount.toFixed(2) })
        .where(eq(shoppingListItems.id, existing.id))
        .returning()
      return updated.id
    }

    const [row] = await tx
      .insert(shoppingListItems)
      .values({
        shoppingListId: shoppingList.id,
        sourceType: values.sourceType,
        foodId: values.foodId,
        productId: values.productId,
        name: values.name,
        amount: values.amount.toFixed(2),
        unit: values.unit,
        status: 'to_buy',
      })
      .returning()
    return row.id
  })

  const item = await getShoppingListItemById(itemId, userId)
  if (!item) throw new Error('Failed to create shopping list item')
  return item
}

export type CreateShoppingListFoodItemData = {
  userId: number
  foodId: number
  amount: number
  unit: string
}

export async function createShoppingListFoodItem(data: CreateShoppingListFoodItemData): Promise<ShoppingListItem> {
  assertAmountInRange(data.amount)

  const food = await getFoodById(data.foodId)
  if (!food) throw new Error('Food not found')

  const allowedUnits = getAllowedUnits(food.measurements, food.servingUnit)
  if (!allowedUnits.includes(data.unit)) {
    throw new Error('Unit is not valid for this food')
  }

  return insertOrMergeItem(data.userId, {
    sourceType: 'food',
    foodId: food.id,
    productId: null,
    name: null,
    amount: data.amount,
    unit: data.unit,
  })
}

export type CreateShoppingListProductItemData = {
  userId: number
  productId: number
  amount: number
  unit: string
}

export async function createShoppingListProductItem(data: CreateShoppingListProductItemData): Promise<ShoppingListItem> {
  assertAmountInRange(data.amount)

  const product = await getProductById(data.productId)
  if (!product) throw new Error('Product not found')

  const allowedUnits = getAllowedUnits(product.measurements, product.servingUnit)
  if (!allowedUnits.includes(data.unit)) {
    throw new Error('Unit is not valid for this product')
  }

  return insertOrMergeItem(data.userId, {
    sourceType: 'product',
    foodId: null,
    productId: product.id,
    name: null,
    amount: data.amount,
    unit: data.unit,
  })
}

export type CreateShoppingListFreeformItemData = {
  userId: number
  name: string
  amount: number
  // Freeform lines take a free-text unit or none at all.
  unit?: string | null
}

export async function createShoppingListFreeformItem(data: CreateShoppingListFreeformItemData): Promise<ShoppingListItem> {
  assertAmountInRange(data.amount)

  const name = data.name.trim()
  if (!name) throw new Error('Name is required')
  if (name.length > FREEFORM_NAME_MAX_LENGTH) throw new Error('Name is too long')

  const rawUnit = data.unit?.trim() ?? ''
  if (rawUnit.length > FREEFORM_UNIT_MAX_LENGTH) throw new Error('Unit is too long')
  const unit = rawUnit.length > 0 ? rawUnit : null

  return insertOrMergeItem(data.userId, {
    sourceType: 'freeform',
    foodId: null,
    productId: null,
    name,
    amount: data.amount,
    unit,
  })
}
