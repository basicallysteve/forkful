import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { foods, ingredients, pantryItems, products, recipes, shoppingListItems, shoppingLists } from '@/db/schema'
import { getFoodById } from '@/lib/foods'
import { getProductById } from '@/lib/products'
import { EACH_UNIT } from '@/utils/unitConversion'
import { computePantryGapShortfall, type PantryGapStock } from '@/utils/pantryGap'
import { round2 } from '@/utils/number'
import type { Food, Measurement } from '@/types/Food'
import type { Product, ProductSource } from '@/types/Product'
import type { ShoppingList, ShoppingListItem, ShoppingListItemSourceType, ShoppingTripCompletion } from '@/types/ShoppingList'

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

// Line Price shares the amount column's numeric(10, 2) shape, so it has the same ceiling. Unlike an
// amount a price of exactly 0 is allowed (a free / comped line); only negatives and NaN are rejected.
function assertPriceInRange(price: number): void {
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be zero or greater')
  if (price > AMOUNT_MAX) throw new Error('Price is too large')
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
    // numeric column maps to a string in Postgres; coerce to a number, keeping null when unpriced.
    linePrice: row.linePrice != null ? Number(row.linePrice) : null,
    expirationDate: row.expirationDate ?? null,
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

// Fetch several lines on the user's active list in one query, returned in the order of `ids` (rows that
// don't resolve — wrong owner, archived, soft-deleted source — are dropped). Used after a split so the
// resulting lines are re-read together rather than one query per id.
async function getShoppingListItemsByIds(ids: number[], userId: number): Promise<ShoppingListItem[]> {
  if (ids.length === 0) return []

  const rows = await db
    .select()
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .leftJoin(foods, eq(shoppingListItems.foodId, foods.id))
    .leftJoin(products, eq(shoppingListItems.productId, products.id))
    .where(and(
      inArray(shoppingListItems.id, ids),
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
      notSoftDeletedSources,
    ))

  const byId = new Map(rows.map((row) => [row.shopping_list_items.id, mapJoinedRow(row)]))
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is ShoppingListItem => item != null)
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

// A concurrent Shopping Trip Completion can archive the active list between the moment an add resolves
// it and the moment the add locks its row. Cap how many times the add re-resolves the (new) active list
// before giving up — a completion creates at most one fresh active list, so a couple of retries covers
// any realistic interleaving; the extra headroom guards against a pathological double-completion.
const INSERT_ACTIVE_LIST_MAX_ATTEMPTS = 3

// A line's merge identity: its sourceType, its source (Food id / Product id / lowercased freeform name),
// and its unit. Two lines merge iff these match. Freeform names fold case-insensitively so "Trash bags"
// and "trash bags" are one line (the existing line keeps its casing); a Food and Product that share a
// name never merge, since the sourceType prefix differs. A null unit gets a sentinel so it can't collide
// with a real unit string. Built as a string key so a whole batch matches against the list's open lines
// in memory, rather than issuing one identity SELECT per value. ` ` can't appear in a unit, Food id,
// or name, so it is a safe field separator.
function lineMergeKey(sourceType: ShoppingListItemSourceType, identity: string, unit: string | null): string {
  return `${sourceType} ${identity} ${unit ?? ' '}`
}

function valuesMergeKey(values: ResolvedNewItem): string {
  const identity = values.sourceType === 'food' ? String(values.foodId)
    : values.sourceType === 'product' ? String(values.productId)
      : (values.name as string).toLowerCase()
  return lineMergeKey(values.sourceType, identity, values.unit)
}

function rowMergeKey(row: typeof shoppingListItems.$inferSelect): string {
  const sourceType = row.sourceType as ShoppingListItemSourceType
  const identity = sourceType === 'food' ? String(row.foodId)
    : sourceType === 'product' ? String(row.productId)
      : (row.name ?? '').toLowerCase()
  return lineMergeKey(sourceType, identity, row.unit)
}

// One line's write plan: fold a batch onto exactly one plan per merge key. `existingId` is the open line
// it lands on (null → a fresh insert); `baseAmount` is that line's current amount (0 for an insert); and
// `addAmount` accumulates every batch value that shares the key. `order` preserves first-seen position.
type LineWritePlan = {
  existingId: number | null
  baseAmount: number
  addAmount: number
  template: ResolvedNewItem
  order: number
}

// Insert several new lines at once, or merge each into an existing open (to_buy) line with the same
// source identity and unit — the batch primitive behind every add. Merging keeps a different unit — or
// an already-bought line — separate. The whole read-then-write runs in ONE transaction that locks the
// parent list row, so (a) two concurrent adds of the same source + unit cannot both miss the existing
// line and insert duplicates, and (b) the batch is atomic: if any line fails validation the entire
// transaction rolls back rather than leaving a partial set of lines behind. Because a concurrent Trip
// Completion archives the list while holding that same row lock, we re-check the status once we hold it;
// if the list was archived out from under us we re-resolve the now-current active list and retry, so a
// line can never land on an archived list. Values within one batch that share identity + unit collapse
// onto a single line. Instead of a SELECT + write per value, the list's open lines are read once and
// matched in memory, then all new lines go in as a single bulk insert (merges are per-line amount
// updates), so the transaction is a small constant number of round-trips regardless of batch size.
// Returns the resulting lines, deduped and in first-seen order.
async function insertOrMergeItems(userId: number, valuesList: ResolvedNewItem[]): Promise<ShoppingListItem[]> {
  if (valuesList.length === 0) return []

  for (let attempt = 0; attempt < INSERT_ACTIVE_LIST_MAX_ATTEMPTS; attempt++) {
    const shoppingList = await getOrCreateActiveShoppingList(userId)

    const itemIds = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: shoppingLists.id, status: shoppingLists.status })
        .from(shoppingLists)
        .where(eq(shoppingLists.id, shoppingList.id))
        .for('update')

      // Archived (or gone) after we resolved it — a concurrent Trip Completion won the race. Signal a
      // retry rather than writing onto a stale list; the next attempt re-resolves the fresh active list.
      if (!locked || locked.status !== 'active') return null

      // Read the list's open lines once; every batch value matches against this map in memory.
      const openRows = await tx
        .select()
        .from(shoppingListItems)
        .where(and(
          eq(shoppingListItems.shoppingListId, shoppingList.id),
          eq(shoppingListItems.status, 'to_buy'),
        ))
      const existingByKey = new Map<string, { id: number; amount: number }>()
      for (const row of openRows) existingByKey.set(rowMergeKey(row), { id: row.id, amount: Number(row.amount) })

      // Fold the batch into one plan per merge key: in-batch duplicates and matches against an existing
      // open line both accumulate onto the same plan.
      const plans = new Map<string, LineWritePlan>()
      let order = 0
      for (const values of valuesList) {
        const key = valuesMergeKey(values)
        let plan = plans.get(key)
        if (!plan) {
          const existing = existingByKey.get(key)
          plan = { existingId: existing?.id ?? null, baseAmount: existing?.amount ?? 0, addAmount: 0, template: values, order: order++ }
          plans.set(key, plan)
        }
        plan.addAmount += values.amount
      }
      const orderedPlans = [...plans.values()].sort((a, b) => a.order - b.order)

      // Validate every final amount before writing anything — covers both a merged total and a plain
      // insert (baseAmount is 0 for a new line), so the whole batch fails atomically rather than partway.
      for (const plan of orderedPlans) assertAmountInRange(plan.baseAmount + plan.addAmount)

      const idByKey = new Map<string, number>()

      // All new lines in a single bulk insert. RETURNING preserves the VALUES order (as elsewhere in this
      // file — see writeSplitPortions), so inserted rows line up with the inserts array by index.
      const inserts = orderedPlans.filter((plan) => plan.existingId === null)
      if (inserts.length > 0) {
        const insertedRows = await tx
          .insert(shoppingListItems)
          .values(inserts.map((plan) => ({
            shoppingListId: shoppingList.id,
            sourceType: plan.template.sourceType,
            foodId: plan.template.foodId,
            productId: plan.template.productId,
            name: plan.template.name,
            // numeric(10,2): round to 2 decimals so an accumulated in-batch sum can't persist a
            // floating-point artifact like "0.30000000000000004".
            amount: plan.addAmount.toFixed(2),
            unit: plan.template.unit,
            status: 'to_buy' as const,
          })))
          .returning({ id: shoppingListItems.id })
        inserts.forEach((plan, index) => idByKey.set(valuesMergeKey(plan.template), insertedRows[index].id))
      }

      // Each merge is an amount update on its existing open line (its source/unit/status are untouched).
      for (const plan of orderedPlans) {
        if (plan.existingId === null) continue
        await tx
          .update(shoppingListItems)
          .set({ amount: (plan.baseAmount + plan.addAmount).toFixed(2) })
          .where(eq(shoppingListItems.id, plan.existingId))
        idByKey.set(valuesMergeKey(plan.template), plan.existingId)
      }

      return orderedPlans.map((plan) => idByKey.get(valuesMergeKey(plan.template)) as number)
    })

    // The list was archived mid-add — re-resolve the current active list and try again.
    if (itemIds === null) continue

    const items = await getShoppingListItemsByIds(itemIds, userId)
    if (items.length !== itemIds.length) throw new Error('Failed to create shopping list item')
    return items
  }

  // Every attempt found the list archived under the lock (a pathological run of concurrent completions).
  throw new Error('Failed to create shopping list item')
}

// Add a single line (insert or merge). Thin wrapper over the batch primitive so every add — one line or
// many — shares the same locking, merge, and archived-list-retry behaviour.
async function insertOrMergeItem(userId: number, values: ResolvedNewItem): Promise<ShoppingListItem> {
  const [item] = await insertOrMergeItems(userId, [values])
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

// Hard-delete a single line off the user's active list (a Remove Item — see CONTEXT.md). The row is
// removed outright: shopping_list_items has no dateDeleted, so there is no soft-delete here. Ownership
// is enforced in one round-trip: the line is deleted only if its list is the caller's active list, via
// a subquery, so a user can neither remove another user's line nor mutate an archived list. Returns
// false when no such line exists (already gone, wrong owner, or archived) so the route can answer 404.
export async function deleteShoppingListItem(id: number, userId: number): Promise<boolean> {
  const deleted = await db
    .delete(shoppingListItems)
    .where(and(
      eq(shoppingListItems.id, id),
      inArray(
        shoppingListItems.shoppingListId,
        db
          .select({ id: shoppingLists.id })
          .from(shoppingLists)
          .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active'))),
      ),
    ))
    .returning({ id: shoppingListItems.id })

  return deleted.length > 0
}

// Change a single line's status on the user's active list (a manual check-off — see CONTEXT.md).
// Only `status` is touched: the line's foodId/productId reference is never altered, so checking a line
// off keeps it pointing at the same Food/Product (scan-to-buy, a later slice, is the only path that
// mutates the reference). Ownership is enforced in one round-trip via the active-list subquery, so a
// user can neither mutate another user's line nor a line on an archived list. Since only `status`
// changes — the caller already holds the rest of the line — the RETURNING is kept to `{ id, status }`
// rather than re-joining the Food/Product to rebuild the whole line. Returns null when no such line
// exists (already gone, wrong owner, or archived) so the route can answer 404.
export async function updateShoppingListItemStatus(
  id: number,
  userId: number,
  status: ShoppingListItem['status'],
): Promise<{ id: number; status: ShoppingListItem['status'] } | null> {
  const [updated] = await db
    .update(shoppingListItems)
    .set({ status })
    .where(and(
      eq(shoppingListItems.id, id),
      inArray(
        shoppingListItems.shoppingListId,
        db
          .select({ id: shoppingLists.id })
          .from(shoppingLists)
          .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active'))),
      ),
    ))
    .returning({ id: shoppingListItems.id, status: shoppingListItems.status })

  return updated ?? null
}

// Optional check-off details: the Line Price total and the expiration date. Each field is independent
// — omit a key to leave it unchanged, or pass null to clear it. The Line Price stored here is always
// the whole-line total; the per-unit ↔ total conversion happens at entry (client-side), so this layer
// only ever persists the total. Only the total is kept — per-unit cost is derived on read.
export type UpdateShoppingListItemDetails = {
  linePrice?: number | null
  expirationDate?: Date | null
}

// Record or edit a line's Line Price / expiration on the user's active list. Ownership is enforced in
// the same one-round-trip way as the status/delete paths (via the active-list subquery), so a user can
// neither touch another user's line nor a line on an archived list. Unlike the status update this
// re-joins and returns the whole line, since callers surface the persisted (rounded) price and the
// derived per-unit cost. Returns null when no such line exists (already gone, wrong owner, or archived)
// so the route can answer 404.
export async function updateShoppingListItemDetails(
  id: number,
  userId: number,
  details: UpdateShoppingListItemDetails,
): Promise<ShoppingListItem | null> {
  const set: Partial<typeof shoppingListItems.$inferInsert> = {}

  if ('linePrice' in details) {
    if (details.linePrice === null) {
      set.linePrice = null
    } else {
      assertPriceInRange(details.linePrice as number)
      // numeric(10, 2): round to 2 decimals so a per-unit × quantity total can't persist a
      // floating-point artifact like "4.500000000000001".
      set.linePrice = (details.linePrice as number).toFixed(2)
    }
  }

  if ('expirationDate' in details) {
    set.expirationDate = details.expirationDate ?? null
  }

  // Nothing to change: report whether the line exists/belongs to the caller without a write.
  if (Object.keys(set).length === 0) {
    return getShoppingListItemById(id, userId)
  }

  const [updated] = await db
    .update(shoppingListItems)
    .set(set)
    .where(and(
      eq(shoppingListItems.id, id),
      inArray(
        shoppingListItems.shoppingListId,
        db
          .select({ id: shoppingLists.id })
          .from(shoppingLists)
          .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active'))),
      ),
    ))
    .returning({ id: shoppingListItems.id })

  if (!updated) return null

  return getShoppingListItemById(updated.id, userId)
}

// One slice of a line after a split: a share of the amount with its own expiration date.
export type ShoppingListItemPortion = {
  amount: number
  expirationDate: Date | null
}

// Amounts are numeric(10, 2), so a portion sum can differ from the line total by rounding noise; allow
// a half-cent of slack when checking the split covers exactly the line.
const AMOUNT_EPSILON = 0.005

// A split yields at most one line per distinct expiration date; cap it well above any realistic number
// of dates so an oversized request can't become an unbounded batch of inserts.
export const MAX_SPLIT_PORTIONS = 100

// The transaction handle Drizzle passes to a db.transaction callback, and a raw line row.
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type ShoppingListItemRow = typeof shoppingListItems.$inferSelect

// Resolve and lock (FOR UPDATE) a line on the caller's active list inside a transaction, so a split is
// ownership-scoped and serialised against concurrent splits of the same line (like insertOrMergeItem).
// Null when no such line exists (wrong owner, archived, or gone).
async function lockActiveLineForUpdate(tx: Transaction, id: number, userId: number): Promise<ShoppingListItemRow | null> {
  const [row] = await tx
    .select()
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.shoppingListId, shoppingLists.id))
    .where(and(
      eq(shoppingListItems.id, id),
      eq(shoppingLists.userId, userId),
      eq(shoppingLists.status, 'active'),
    ))
    .for('update')

  return row ? row.shopping_list_items : null
}

// Distribute a Line Price total across portions in proportion to amount; the first portion absorbs the
// rounding remainder so the parts still sum to exactly the total. A null total leaves every share null.
function distributeLinePrice(total: number | null, portions: ShoppingListItemPortion[], lineAmount: number): (number | null)[] {
  if (total == null) return portions.map(() => null)

  const prices = portions.map((portion) => round2((total * portion.amount) / lineAmount))
  const remainder = round2(total - prices.reduce((sum, price) => sum + price, 0))
  prices[0] = round2(prices[0] + remainder)
  // The shares derive from a validated total, but guard against a rounding artifact pushing one out of
  // range before it reaches the column.
  for (const price of prices) assertPriceInRange(price)
  return prices
}

// Rewrite the original row as the first portion and insert the rest as sibling lines that copy its
// source (foodId/productId/name), unit, and status — so a split only re-partitions quantity and dates,
// never what is being bought. Returns every resulting line id, the original (first portion) first.
async function writeSplitPortions(
  tx: Transaction,
  line: ShoppingListItemRow,
  portions: ShoppingListItemPortion[],
  prices: (number | null)[],
): Promise<number[]> {
  await tx
    .update(shoppingListItems)
    .set({
      amount: portions[0].amount.toFixed(2),
      expirationDate: portions[0].expirationDate ?? null,
      linePrice: prices[0] != null ? prices[0].toFixed(2) : null,
    })
    .where(eq(shoppingListItems.id, line.id))

  if (portions.length === 1) return [line.id]

  const inserted = await tx
    .insert(shoppingListItems)
    .values(portions.slice(1).map((portion, index) => ({
      shoppingListId: line.shoppingListId,
      sourceType: line.sourceType,
      foodId: line.foodId,
      productId: line.productId,
      name: line.name,
      unit: line.unit,
      status: line.status,
      amount: portion.amount.toFixed(2),
      expirationDate: portion.expirationDate ?? null,
      linePrice: prices[index + 1] != null ? (prices[index + 1] as number).toFixed(2) : null,
    })))
    .returning({ id: shoppingListItems.id })

  return [line.id, ...inserted.map((row) => row.id)]
}

// Split one line into several, each carrying a share of the amount and its own expiration date — the
// persistence behind "different expiration dates per item" (see CONTEXT.md). The portions must sum to
// the line's current amount. A Line Price, if set, is distributed across them in proportion to amount so
// the parts still sum to the original total. Returns null when no such line exists (already gone, wrong
// owner, or archived) so the route can answer 404. Returns every resulting line, first portion first.
export async function splitShoppingListItem(
  id: number,
  userId: number,
  portions: ShoppingListItemPortion[],
  options: { linePrice?: number | null } = {},
): Promise<ShoppingListItem[] | null> {
  if (portions.length === 0) throw new Error('At least one portion is required')
  if (portions.length > MAX_SPLIT_PORTIONS) throw new Error('Too many portions')

  // Round each share to the column scale up front so validation and persistence agree — a sub-cent
  // share that would round to 0.00 is rejected as non-positive rather than silently stored as a
  // zero-amount line.
  const rounded: ShoppingListItemPortion[] = portions.map((portion) => ({
    amount: round2(portion.amount),
    expirationDate: portion.expirationDate,
  }))
  for (const portion of rounded) assertAmountInRange(portion.amount)
  if (options.linePrice != null) assertPriceInRange(options.linePrice)

  const ids = await db.transaction(async (tx) => {
    const line = await lockActiveLineForUpdate(tx, id, userId)
    if (!line) return null

    const lineAmount = Number(line.amount)
    const portionsTotal = rounded.reduce((sum, portion) => sum + portion.amount, 0)
    if (Math.abs(portionsTotal - lineAmount) > AMOUNT_EPSILON) {
      throw new Error('Portions must sum to the line amount')
    }

    // A price passed with the split (the dialog may edit price and dates together) overrides the stored
    // one; otherwise the current total is distributed. `undefined` leaves it as stored; `null` clears it.
    const total = 'linePrice' in options
      ? options.linePrice ?? null
      : line.linePrice != null ? Number(line.linePrice) : null
    const prices = distributeLinePrice(total, rounded, lineAmount)

    return writeSplitPortions(tx, line, rounded, prices)
  })

  if (ids === null) return null

  return getShoppingListItemsByIds(ids, userId)
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

// The outcome of a Pantry-Gap Fill: the Food lines added (or merged into) the active list for the
// ingredients that were short, plus how many ingredients were skipped because they were already fully
// in stock. `null` from the function itself means the recipe wasn't found (→ 404); an empty `items`
// with a non-zero skip count means everything was already covered.
export type PantryGapFillResult = {
  items: ShoppingListItem[]
  skippedFullyStocked: number
}

// Pantry-Gap Fill (see CONTEXT.md): populate the active Shopping List with only the *missing* portion of
// a Recipe's ingredients. Each ingredient is matched against current Pantry stock with the same
// Food-matching as Meal Preparation Deduction — a `'food'` Pantry Item matches on `foodId`, a
// `'product'` one on its Product's `parentFoodId`. For any ingredient not fully covered, a `'food'` line
// referencing that ingredient's Food is added for the shortfall (in the ingredient's unit); fully-stocked
// ingredients are skipped, and an unconvertible / uncalibrated shortfall falls back to the full required
// quantity. Returns null when the recipe isn't visible to the user (missing, soft-deleted, or private).
export async function fillPantryGapFromRecipe(
  userId: number,
  recipeShortId: string,
): Promise<PantryGapFillResult | null> {
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(
      eq(recipes.shortId, recipeShortId),
      isNull(recipes.dateDeleted),
      or(eq(recipes.userId, userId), eq(recipes.isPublic, 1)),
    ))

  if (!recipe) return null

  const ingredientRows = await db
    .select()
    .from(ingredients)
    .innerJoin(foods, eq(ingredients.foodId, foods.id))
    .where(and(eq(ingredients.recipeId, recipe.id), isNull(ingredients.dateDeleted), isNull(foods.dateDeleted)))

  if (ingredientRows.length === 0) return { items: [], skippedFullyStocked: 0 }

  const foodIds = ingredientRows.map((r) => r.foods.id)

  // Food-sourced Pantry stock matching any ingredient Food (foodId), mirroring Meal Prep Deduction.
  const foodPantryRows = await db
    .select()
    .from(pantryItems)
    .innerJoin(foods, eq(pantryItems.foodId, foods.id))
    .where(and(
      eq(pantryItems.userId, userId),
      isNull(pantryItems.dateDeleted),
      isNull(foods.dateDeleted),
      inArray(pantryItems.foodId, foodIds),
    ))

  // Product-sourced Pantry stock whose Product's parentFoodId matches any ingredient Food.
  const productPantryRows = await db
    .select()
    .from(pantryItems)
    .innerJoin(products, eq(pantryItems.productId, products.id))
    .where(and(
      eq(pantryItems.userId, userId),
      isNull(pantryItems.dateDeleted),
      isNull(products.dateDeleted),
      inArray(products.parentFoodId, foodIds),
    ))

  // Group both stock sources by the ingredient Food they cover once, so each ingredient is an O(1)
  // lookup below rather than a full scan of every pantry row (the loop was O(ingredients × pantryRows)).
  const stockByFoodId = new Map<number, PantryGapStock[]>()
  const addStock = (foodId: number, entry: PantryGapStock) => {
    const existing = stockByFoodId.get(foodId)
    if (existing) existing.push(entry)
    else stockByFoodId.set(foodId, [entry])
  }
  for (const r of foodPantryRows) {
    addStock(r.foods.id, {
      amount: Number(r.pantry_items.currentSizeAmount),
      unit: r.pantry_items.currentSizeUnit ?? r.foods.servingUnit ?? 'g',
      density: r.foods.density != null ? Number(r.foods.density) : undefined,
      measurements: parseMeasurements(r.foods.measurements),
    })
  }
  for (const r of productPantryRows) {
    // The query already restricts parentFoodId to foodIds, so it is non-null here; guard for the type.
    if (r.products.parentFoodId == null) continue
    addStock(r.products.parentFoodId, {
      amount: Number(r.pantry_items.currentSizeAmount),
      unit: r.pantry_items.currentSizeUnit ?? r.products.servingUnit ?? 'g',
      density: r.products.density != null ? Number(r.products.density) : undefined,
      measurements: parseMeasurements(r.products.measurements),
    })
  }

  // Compute (and validate) every shortfall up front, before any write, so a validation error can't leave
  // a partially-filled list behind; the write itself is then a single atomic batch (see insertOrMergeItems).
  const lines: ResolvedNewItem[] = []
  let skippedFullyStocked = 0

  for (const { ingredients: ing, foods: food } of ingredientRows) {
    const ingredientUnit = ing.servingUnit ?? food.servingUnit ?? 'g'

    const shortfall = computePantryGapShortfall(
      {
        requiredQuantity: Number(ing.quantity),
        unit: ingredientUnit,
        density: food.density != null ? Number(food.density) : undefined,
        measurements: parseMeasurements(food.measurements),
      },
      stockByFoodId.get(food.id) ?? [],
    )

    // null = the ingredient is already fully in stock; skip it.
    if (shortfall === null) {
      skippedFullyStocked++
      continue
    }

    // The shortfall derives from persisted numeric(10,2) values, but guard the column ceiling before it
    // reaches the write — the same range check createShoppingListFoodItem applies to a user-entered amount.
    assertAmountInRange(shortfall)

    lines.push({
      sourceType: 'food',
      foodId: food.id,
      productId: null,
      name: null,
      amount: shortfall,
      unit: ingredientUnit,
    })
  }

  const items = await insertOrMergeItems(userId, lines)
  return { items, skippedFullyStocked }
}

// Finish a shopping trip (see CONTEXT.md "Shopping Trip Completion"). Archives the user's active list,
// turns every *bought* Food/Product line into exactly one Pantry Item (originalSize = the line's
// quantity + unit, currentSize equal, expiration carried when set, and a provenance FK back to the
// source line), and never transfers freeform lines. Still-unbought lines (`to_buy` and `unavailable`
// together) are handled as one group: when `keepUnbought` they move onto a fresh active list, otherwise
// they are discarded with the archive. The Line Price stays on the archived line — it is never copied
// to the Pantry. The whole thing runs in one transaction that locks the active list row, so a
// concurrent completion (or add) can't race it. Returns null when the user has no active list (→ 404).
export async function completeShoppingTrip(
  userId: number,
  options: { keepUnbought: boolean },
): Promise<ShoppingTripCompletion | null> {
  const outcome = await db.transaction(async (tx) => {
    // Lock the active list so a concurrent completion/add serialises behind this one.
    const [list] = await tx
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, 'active')))
      .for('update')

    if (!list) return null

    // Join the source Food/Product so a line pointing at a soft-deleted one can be recognised. Freeform
    // lines join neither. `.select()` returns the joined rows as { shopping_list_items, foods, products }.
    const rows = await tx
      .select()
      .from(shoppingListItems)
      .leftJoin(foods, eq(shoppingListItems.foodId, foods.id))
      .leftJoin(products, eq(shoppingListItems.productId, products.id))
      .where(eq(shoppingListItems.shoppingListId, list.id))

    // Archive the current list before touching anything else. Doing it first frees the partial unique
    // "one active list per user" index so the fresh active list below can be inserted.
    await tx.update(shoppingLists).set({ status: 'archived' }).where(eq(shoppingLists.id, list.id))

    // Bought Food/Product lines with a live source each become one Pantry Item; bought freeform lines
    // never transfer. A line whose Food/Product was soft-deleted since it was added is skipped too:
    // getShoppingListItems already hides such a line and getPantryItems would hide the resulting item,
    // so transferring it would only orphan invisible stock.
    const transferable = rows.filter(({ shopping_list_items: line, foods: food, products: product }) => {
      if (line.status !== 'bought') return false
      if (line.sourceType === 'food') return food != null && food.dateDeleted == null
      if (line.sourceType === 'product') return product != null && product.dateDeleted == null
      return false
    })
    if (transferable.length > 0) {
      await tx.insert(pantryItems).values(transferable.map(({ shopping_list_items: line }) => ({
        userId,
        sourceType: line.sourceType,
        foodId: line.foodId,
        productId: line.productId,
        // Carried when the line recorded one; null otherwise. Line Price is deliberately not copied.
        expirationDate: line.expirationDate,
        // amount is a numeric column, already a string on read — pass it straight through.
        originalSizeAmount: line.amount,
        originalSizeUnit: line.unit,
        currentSizeAmount: line.amount,
        currentSizeUnit: line.unit,
        shoppingListItemId: line.id,
      })))
    }

    // `to_buy` and `unavailable` are not distinguished here — both are "still unbought" and handled as
    // one batch. Kept lines move to a new active list; dropped lines stay on the archive.
    const unbought = rows
      .map(({ shopping_list_items: line }) => line)
      .filter((line) => line.status === 'to_buy' || line.status === 'unavailable')

    let keptCount = 0
    if (options.keepUnbought && unbought.length > 0) {
      const [newList] = await tx
        .insert(shoppingLists)
        .values({ userId, status: 'active' })
        .returning({ id: shoppingLists.id })

      await tx
        .update(shoppingListItems)
        .set({ shoppingListId: newList.id })
        .where(inArray(shoppingListItems.id, unbought.map((row) => row.id)))

      keptCount = unbought.length
    }

    return {
      pantryItemsCreated: transferable.length,
      keptCount,
      droppedCount: options.keepUnbought ? 0 : unbought.length,
    }
  })

  if (outcome === null) return null

  // Re-read the active list's contents: the kept lines (now on the fresh list) when keeping, else empty
  // (no active list exists until one is lazily created on the next visit).
  const items = await getShoppingListItems(userId)
  return { ...outcome, items }
}
