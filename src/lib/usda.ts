import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

function getApiKey(): string {
  const key = process.env.USDA_API_KEY
  if (!key) throw new Error('USDA_API_KEY environment variable is not set. Get a free key at https://fdc.nal.usda.gov/api-key-signup.html')
  return key
}

// ---- Raw API types ----

export interface USDANutrient {
  nutrientId: number
  nutrientName: string
  value: number
  unitName: string
}

export interface USDAFoodItem {
  fdcId: number
  description: string
  dataType: string
  foodNutrients: USDANutrient[]
  servingSize?: number
  servingSizeUnit?: string
}

export interface USDABrandedItem extends USDAFoodItem {
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  householdServingFullText?: string
}

interface USDASearchResponse {
  foods: (USDAFoodItem | USDABrandedItem)[]
  totalHits: number
}

// ---- Nutrient ID constants ----
const KCAL_ID = 1008
const PROTEIN_ID = 1003
const CARBS_ID = 1005
const FAT_ID = 1004
const FIBER_ID = 1079
const SAT_FAT_ID = 1258
const SUGAR_ID = 2000
const SODIUM_ID = 1093

function getNutrientValue(nutrients: USDANutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0
}

function getNutrientValueOrUndefined(nutrients: USDANutrient[], id: number): number | undefined {
  const nutrient = nutrients.find(n => n.nutrientId === id)
  return nutrient != null ? nutrient.value : undefined
}

// ---- Search relevance re-ranking ----

/**
 * Score a USDA description against the user's query.
 * Higher score = better match. We fetch a large pool from the API (which uses
 * word-frequency ranking) then re-sort by phrase quality so exact / prefix
 * matches surface above incidental word matches.
 *
 * Tiers:
 *   4 — exact match
 *   3 — description starts with the full query
 *   2 — description contains the full query as a substring
 *   1 — description contains every word of the query
 *   0 — partial match (USDA's default: some words match)
 */
function matchScore(description: string, query: string): number {
  const desc = description.toLowerCase()
  const q = query.toLowerCase().trim()
  if (desc === q) return 4
  if (desc.startsWith(q)) return 3
  if (desc.includes(q)) return 2
  const words = q.split(/\s+/)
  if (words.length > 1 && words.every(w => desc.includes(w))) return 1
  return 0
}

function rerank<T extends USDAFoodItem>(items: T[], query: string): T[] {
  return [...items].sort((a, b) => matchScore(b.description, query) - matchScore(a.description, query))
}

// ---- Search functions ----

export async function searchUSDAFoods(query: string): Promise<USDAFoodItem[]> {
  const apiKey = getApiKey()
  const params = new URLSearchParams({
    query,
    dataType: 'Foundation,SR Legacy',
    pageSize: '25',   // fetch a bigger pool so re-ranking has candidates to work with
    api_key: apiKey,
  })
  const res = await fetch(`${USDA_BASE}/foods/search?${params}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`)
  const data: USDASearchResponse = await res.json()
  return rerank((data.foods ?? []) as USDAFoodItem[], query).slice(0, 8)
}

export async function searchUSDABranded(query: string): Promise<USDABrandedItem[]> {
  const apiKey = getApiKey()
  const params = new URLSearchParams({
    query,
    dataType: 'Branded',
    pageSize: '25',
    api_key: apiKey,
  })
  const res = await fetch(`${USDA_BASE}/foods/search?${params}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`USDA branded search failed: ${res.status}`)
  const data: USDASearchResponse = await res.json()
  return rerank((data.foods ?? []) as USDABrandedItem[], query).slice(0, 8)
}

// ---- Mapping functions ----

/**
 * Maps a USDA Foundation/SR Legacy food item to a Food (generic, per 100g).
 * Foundation/SR Legacy nutrients are always expressed per 100g.
 */
export function mapUSDAFoodToFood(item: USDAFoodItem): Omit<Food, 'id'> {
  const n = item.foodNutrients
  return {
    name: item.description,
    calories: Math.round(getNutrientValue(n, KCAL_ID)),
    protein: Math.round(getNutrientValue(n, PROTEIN_ID) * 10) / 10,
    carbs: Math.round(getNutrientValue(n, CARBS_ID) * 10) / 10,
    fat: Math.round(getNutrientValue(n, FAT_ID) * 10) / 10,
    fiber: Math.round(getNutrientValue(n, FIBER_ID) * 10) / 10,
    saturatedFat: (() => {
      const v = getNutrientValueOrUndefined(n, SAT_FAT_ID)
      return v != null ? Math.round(v * 10) / 10 : undefined
    })(),
    sugar: (() => {
      const v = getNutrientValueOrUndefined(n, SUGAR_ID)
      return v != null ? Math.round(v * 10) / 10 : undefined
    })(),
    sodium: (() => {
      const v = getNutrientValueOrUndefined(n, SODIUM_ID)
      // USDA Foundation/SR Legacy sodium is in mg already
      return v != null ? Math.round(v) : undefined
    })(),
    servingSize: 100,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }],
    externalId: String(item.fdcId),
    source: 'usda' as const,
  }
}

/**
 * Maps a USDA Branded food item to a Product.
 * Branded foods have their own serving size from the label.
 * Nutrients in the USDA Branded database are expressed per 100g and must be scaled.
 */
export function mapUSDABrandedToProduct(item: USDABrandedItem): Omit<Product, 'id'> {
  const n = item.foodNutrients
  const servingSize = item.servingSize ?? 100
  const servingUnit = item.servingSizeUnit ?? 'g'
  // Branded foods: nutrients are per 100g in FDC API; scale to serving size
  const isGramBased = /^g$/i.test(servingUnit)
  const scale = isGramBased ? servingSize / 100 : 1

  return {
    name: item.description,
    barcode: (item as USDABrandedItem).gtinUpc ?? undefined,
    externalId: String(item.fdcId),
    calories: Math.round(getNutrientValue(n, KCAL_ID) * scale),
    protein: Math.round(getNutrientValue(n, PROTEIN_ID) * scale * 10) / 10,
    carbs: Math.round(getNutrientValue(n, CARBS_ID) * scale * 10) / 10,
    fat: Math.round(getNutrientValue(n, FAT_ID) * scale * 10) / 10,
    fiber: Math.round(getNutrientValue(n, FIBER_ID) * scale * 10) / 10,
    saturatedFat: (() => {
      const v = getNutrientValueOrUndefined(n, SAT_FAT_ID)
      return v != null ? Math.round(v * scale * 10) / 10 : undefined
    })(),
    sugar: (() => {
      const v = getNutrientValueOrUndefined(n, SUGAR_ID)
      return v != null ? Math.round(v * scale * 10) / 10 : undefined
    })(),
    sodium: (() => {
      const v = getNutrientValueOrUndefined(n, SODIUM_ID)
      return v != null ? Math.round(v * scale) : undefined
    })(),
    servingSize,
    servingUnit,
    measurements: [{ unit: servingUnit }],
    source: 'usda_branded' as const,
  }
}
