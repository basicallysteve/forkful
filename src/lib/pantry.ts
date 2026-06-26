import { eq, isNull, isNotNull, and, or, inArray, lte, gt, asc, desc, sql, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { pantryItems, foods, products, recipes, ingredients } from '@/db/schema'
import type { PantryItem, PantryItemStatus } from '@/types/PantryItem'
import type { Food, Measurement } from '@/types/Food'
import type { Product } from '@/types/Product'
import { calculatePantryStatus } from '@/utils/pantryStatus'
import { canConvert, convertUnit, getUnitCategory } from '@/utils/unitConversion'

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
    saturatedFat: row.saturatedFat != null ? Number(row.saturatedFat) : undefined,
    sugar: row.sugar != null ? Number(row.sugar) : undefined,
    sodium: row.sodium != null ? Number(row.sodium) : undefined,
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? 'g',
    measurements: parseMeasurements(row.measurements),
    source: (row.source as import('@/types/Product').ProductSource) ?? 'manual',
  }
}

function mapPantryItem(
  row: typeof pantryItems.$inferSelect,
  food?: Food,
  product?: Product
): PantryItem {
  const expirationDate = row.expirationDate ? new Date(row.expirationDate) : null
  const sourceType = (row.sourceType as 'food' | 'product' | 'recipe') ?? 'food'
  return {
    id: row.id,
    sourceType,
    food,
    product,
    recipeId: row.recipeId ?? null,
    recipeNameSnapshot: row.recipeNameSnapshot ?? null,
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

    const dir = options.sortDir === 'desc' ? 'DESC' : 'ASC'
    const orderBy = (() => {
      switch (options.sortBy) {
        case 'name':
          return sql`COALESCE(${foods.name}, ${products.name}) ${sql.raw(dir)}`
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
          or(isNull(pantryItems.foodId), isNull(foods.dateDeleted)),
          or(isNull(pantryItems.productId), isNull(products.dateDeleted)),
          statusFilter,
          options.search
            ? or(ilike(foods.name, `%${options.search}%`), ilike(products.name, `%${options.search}%`))
            : undefined,
        )
      )
      .orderBy(orderBy)

    return rows.map(row => mapPantryItem(
      row.pantry_items,
      row.foods ? mapFoodRow(row.foods) : undefined,
      row.products ? mapProductRow(row.products) : undefined
    ))
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
          or(isNull(pantryItems.foodId), isNull(foods.dateDeleted)),
          or(isNull(pantryItems.productId), isNull(products.dateDeleted)),
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
          or(isNull(pantryItems.foodId), isNull(foods.dateDeleted)),
          or(isNull(pantryItems.productId), isNull(products.dateDeleted)),
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
  sourceType?: 'food' | 'product' | 'recipe'
  foodId?: number
  productId?: number
  recipeId?: number
  recipeNameSnapshot?: string
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
    recipeId: data.recipeId ?? null,
    recipeNameSnapshot: data.recipeNameSnapshot ?? null,
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

export async function updatePantryItem({ id, userId, data }: { id: number; userId: number; data: UpdatePantryItemData }): Promise<PantryItem | null> {
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

const EXPIRING_SOON_DAYS = 7

export type PantryMatchOption = {
  pantryItemId: number
  itemName: string
  currentSize: { size: number; unit: string }
  expirationDate: Date | null
  isExpiringSoon: boolean
  canAutoConvert: boolean
  suggestedDeductAmount: number | null
}

export type IngredientMatch = {
  ingredientFoodId: number
  ingredientFoodName: string
  ingredientQuantity: number
  ingredientUnit: string
  pantryMatches: PantryMatchOption[]
}

export async function getIngredientPantryMatches(
  recipeShortId: string,
  userId: number
): Promise<IngredientMatch[]> {
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.shortId, recipeShortId), isNull(recipes.dateDeleted)))

  if (!recipe) return []

  const ingredientRows = await db
    .select()
    .from(ingredients)
    .innerJoin(foods, eq(ingredients.foodId, foods.id))
    .where(and(eq(ingredients.recipeId, recipe.id), isNull(ingredients.dateDeleted), isNull(foods.dateDeleted)))

  if (ingredientRows.length === 0) return []

  const foodIds = ingredientRows.map(r => r.foods.id)
  const now = new Date()
  const soonCutoff = new Date(now)
  soonCutoff.setDate(soonCutoff.getDate() + EXPIRING_SOON_DAYS)

  // Fetch food-sourced pantry items matching any ingredient food
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

  // Fetch product-sourced pantry items where parentFoodId matches any ingredient food
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

  return ingredientRows.map(({ ingredients: ing, foods: food }) => {
    const ingredientUnit = ing.servingUnit ?? food.servingUnit ?? 'g'
    const ingredientQty = Number(ing.quantity)
    const foodDensity = food.density ? Number(food.density) : undefined
    const foodMeasurements: Measurement[] = Array.isArray(food.measurements)
      ? food.measurements.map((m) => (typeof m === 'string' ? { unit: m } : m as Measurement))
      : []

    const matchingFood = foodPantryRows.filter(r => r.foods.id === food.id)
    const matchingProduct = productPantryRows.filter(r => r.products.parentFoodId === food.id)

    const buildMatch = (
      row: typeof pantryItems.$inferSelect,
      itemName: string,
      pantryUnit: string,
      density?: number,
      measurements?: Measurement[]
    ): PantryMatchOption => {
      const currentSizeAmount = Number(row.currentSizeAmount)
      const exp = row.expirationDate ? new Date(row.expirationDate) : null
      const isExpiringSoon = exp ? exp > now && exp <= soonCutoff : false

      // Try standard unit conversion first
      let suggestedDeductAmount: number | null = null
      let canAutoConvert = false

      const pantryUnitCat = getUnitCategory(pantryUnit)
      const ingUnitCat = getUnitCategory(ingredientUnit)

      if (pantryUnitCat !== 'custom' && ingUnitCat !== 'custom') {
        const converted = convertUnit({ value: ingredientQty, fromUnit: ingredientUnit, toUnit: pantryUnit, density })
        if (converted !== null) {
          canAutoConvert = true
          suggestedDeductAmount = Math.min(converted, currentSizeAmount)
        }
      } else if (ingUnitCat !== 'custom' && pantryUnitCat === 'custom') {
        // Ingredient in standard unit, pantry in custom — need gramsPerUnit on pantry food
        const pantryMeasurement = (measurements ?? []).find(m => m.unit === pantryUnit)
        if (pantryMeasurement?.gramsPerUnit) {
          // Convert ingredient to grams, then divide by gramsPerUnit
          const gramsConverted = convertUnit({ value: ingredientQty, fromUnit: ingredientUnit, toUnit: 'g', density })
          if (gramsConverted !== null) {
            canAutoConvert = true
            const customUnits = gramsConverted / pantryMeasurement.gramsPerUnit
            suggestedDeductAmount = Math.min(customUnits, currentSizeAmount)
          }
        }
      } else if (ingUnitCat === 'custom' && pantryUnitCat !== 'custom') {
        // Ingredient in custom unit, pantry in standard — need gramsPerUnit on ingredient food
        const ingMeasurement = foodMeasurements.find(m => m.unit === ingredientUnit)
        if (ingMeasurement?.gramsPerUnit) {
          const grams = ingredientQty * ingMeasurement.gramsPerUnit
          const converted = convertUnit({ value: grams, fromUnit: 'g', toUnit: pantryUnit, density })
          if (converted !== null) {
            canAutoConvert = true
            suggestedDeductAmount = Math.min(converted, currentSizeAmount)
          }
        }
      }

      return {
        pantryItemId: row.id,
        itemName,
        currentSize: { size: currentSizeAmount, unit: pantryUnit },
        expirationDate: exp,
        isExpiringSoon,
        canAutoConvert,
        suggestedDeductAmount,
      }
    }

    const pantryMatches: PantryMatchOption[] = [
      ...matchingFood.map(r =>
        buildMatch(
          r.pantry_items,
          r.foods.name,
          r.pantry_items.currentSizeUnit ?? r.foods.servingUnit ?? 'g',
          r.foods.density ? Number(r.foods.density) : undefined,
          Array.isArray(r.foods.measurements)
            ? (r.foods.measurements as Measurement[])
            : []
        )
      ),
      ...matchingProduct.map(r =>
        buildMatch(
          r.pantry_items,
          r.products.name,
          r.pantry_items.currentSizeUnit ?? r.products.servingUnit ?? 'g',
          r.products.density ? Number(r.products.density) : undefined,
          Array.isArray(r.products.measurements)
            ? (r.products.measurements as Measurement[])
            : []
        )
      ),
    ]

    // Surface soonest-expiring first; items with no expiry go last
    pantryMatches.sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0
      if (!a.expirationDate) return 1
      if (!b.expirationDate) return -1
      return a.expirationDate.getTime() - b.expirationDate.getTime()
    })

    return {
      ingredientFoodId: food.id,
      ingredientFoodName: food.name,
      ingredientQuantity: ingredientQty,
      ingredientUnit,
      pantryMatches,
    }
  })
}

export type PreparedMealDeduction = {
  pantryItemId: number
  amount: number
}

export async function createPreparedMeal({
  userId,
  recipeShortId,
  servings,
  expirationDate,
  deductions,
}: {
  userId: number
  recipeShortId: string
  servings: number
  expirationDate?: Date | null
  deductions: PreparedMealDeduction[]
}): Promise<PantryItem> {
  const [recipe] = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(and(eq(recipes.shortId, recipeShortId), isNull(recipes.dateDeleted)))

  if (!recipe) throw new Error('Recipe not found')

  const item = await createPantryItem({
    userId,
    sourceType: 'recipe',
    recipeId: recipe.id,
    recipeNameSnapshot: recipe.name,
    originalSizeAmount: servings,
    originalSizeUnit: 'serving',
    currentSizeAmount: servings,
    currentSizeUnit: 'serving',
    expirationDate: expirationDate ?? null,
  })

  // Apply deductions — subtract from each pantry item's currentSizeAmount, floor at 0
  for (const { pantryItemId, amount } of deductions) {
    if (amount <= 0) continue
    const [target] = await db
      .select({ currentSizeAmount: pantryItems.currentSizeAmount })
      .from(pantryItems)
      .where(and(eq(pantryItems.id, pantryItemId), eq(pantryItems.userId, userId), isNull(pantryItems.dateDeleted)))
    if (!target) continue
    const remaining = Math.max(0, Number(target.currentSizeAmount) - amount)
    await db
      .update(pantryItems)
      .set({ currentSizeAmount: String(remaining) })
      .where(and(eq(pantryItems.id, pantryItemId), eq(pantryItems.userId, userId)))
  }

  return item
}
