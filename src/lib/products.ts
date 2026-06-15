import { eq, isNull, and, ilike, asc, desc } from 'drizzle-orm'
import { db } from '@/db'
import { products, pantryItems } from '@/db/schema'
import type { Product, ProductSource } from '@/types/Product'
import type { Measurement } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export type ProductQueryOptions = {
  search?: string
  sortBy?: 'name' | 'calories'
  sortDir?: 'asc' | 'desc'
}

function parseMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return []
  return raw.map((m) => (typeof m === 'string' ? { unit: m } : m as Measurement))
}

function mapProduct(row: typeof products.$inferSelect): Product {
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
    source: (row.source as ProductSource) ?? 'manual',
  }
}

export async function getProducts(options: ProductQueryOptions = {}): Promise<Product[]> {
  try {
    const where = options.search
      ? and(isNull(products.dateDeleted), ilike(products.name, `%${options.search}%`))
      : isNull(products.dateDeleted)

    const orderByCol = options.sortBy === 'calories' ? products.calories : products.name
    const orderBy = options.sortDir === 'desc' ? desc(orderByCol) : asc(orderByCol)

    const rows = await db.select().from(products).where(where).orderBy(orderBy)
    return rows.map(mapProduct)
  } catch {
    return []
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const [row] = await db.select().from(products).where(and(eq(products.slug, slug), isNull(products.dateDeleted)))
  return row ? mapProduct(row) : null
}

export async function getProductById(id: number): Promise<Product | null> {
  const [row] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.dateDeleted)))
  return row ? mapProduct(row) : null
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const [row] = await db.select().from(products).where(and(eq(products.barcode, barcode), isNull(products.dateDeleted)))
  return row ? mapProduct(row) : null
}

export async function getProductByExternalId(externalId: string): Promise<Product | null> {
  const [row] = await db.select().from(products).where(and(eq(products.externalId, externalId), isNull(products.dateDeleted)))
  return row ? mapProduct(row) : null
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  const [row] = await db.insert(products).values({
    name: data.name,
    slug: toSlug(data.name),
    barcode: data.barcode ?? null,
    externalId: data.externalId ?? null,
    parentFoodId: data.parentFoodId ?? null,
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
    source: data.source ?? 'manual',
  }).returning()
  return mapProduct(row)
}

export async function updateProduct(id: number, data: Partial<Omit<Product, 'id'>>): Promise<Product | null> {
  const updates: Partial<typeof products.$inferInsert> = {}
  if (data.name !== undefined) {
    updates.name = data.name
    updates.slug = toSlug(data.name)
  }
  if (data.barcode !== undefined) updates.barcode = data.barcode ?? null
  if (data.externalId !== undefined) updates.externalId = data.externalId ?? null
  if (data.parentFoodId !== undefined) updates.parentFoodId = data.parentFoodId ?? null
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

  const [row] = await db.update(products).set(updates).where(eq(products.id, id)).returning()
  return row ? mapProduct(row) : null
}

export async function deleteProduct(id: number): Promise<boolean> {
  const [active] = await db
    .select({ id: pantryItems.id })
    .from(pantryItems)
    .where(and(eq(pantryItems.productId, id), isNull(pantryItems.dateDeleted)))
    .limit(1)
  if (active) throw new Error('Cannot delete a product that is currently in the pantry')

  const [row] = await db.update(products)
    .set({ dateDeleted: new Date() })
    .where(eq(products.id, id))
    .returning()
  return !!row
}
