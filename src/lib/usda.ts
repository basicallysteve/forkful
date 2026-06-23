import type { Food, Measurement } from '@/types/Food'
import { complete, Models, AIBudgetExhaustedError } from '@/lib/ai'
export { AIBudgetExhaustedError } from '@/lib/ai'
import type { Product } from '@/types/Product'
import { getUnitCategory } from '@/utils/unitConversion'
import convert from 'convert-units'

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

export interface USDAFoodPortion {
  id?: number
  amount?: number
  gramWeight: number
  portionDescription?: string
  measureUnit?: {
    id?: number
    name?: string
    abbreviation?: string
  }
  modifier?: string
}

interface USDADetailItem extends USDAFoodItem {
  foodPortions?: USDAFoodPortion[]
}

// ---- Unit name normalisation ----

const USDA_UNIT_ALIASES: Record<string, string> = {
  cup: 'cup', cups: 'cup',
  tbsp: 'Tbs', tbs: 'Tbs', tablespoon: 'Tbs', tablespoons: 'Tbs',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  'fl oz': 'fl-oz', 'fl-oz': 'fl-oz', 'fluid ounce': 'fl-oz', 'fluid ounces': 'fl-oz',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', pound: 'lb', pounds: 'lb',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
}

function normaliseUSDAUnit(raw: string | undefined): string | null {
  if (!raw) return null
  return USDA_UNIT_ALIASES[raw.toLowerCase().trim()] ?? null
}

// ---- Portion → Measurements + density ----

export function mapPortionsToData(portions: USDAFoodPortion[]): { measurements: Measurement[]; density?: number } {
  const measurements: Measurement[] = []
  let density: number | undefined

  for (const portion of portions) {
    const amount = portion.amount ?? 1
    if (amount <= 0 || portion.gramWeight <= 0) continue

    const rawUnit = portion.measureUnit?.abbreviation ?? portion.measureUnit?.name ?? portion.modifier
    if (!rawUnit?.trim()) continue

    const normUnit = normaliseUSDAUnit(rawUnit)

    if (normUnit) {
      // Known standard unit — use for density derivation if volume
      const category = getUnitCategory(normUnit)
      if (category === 'volume' && density === undefined) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mlPerUnit = convert(1).from(normUnit as any).to('ml' as any)
          const mlTotal = mlPerUnit * amount
          if (mlTotal > 0) {
            density = Math.round((portion.gramWeight / mlTotal) * 10000) / 10000
          }
        } catch {
          // unknown unit — skip
        }
      }
      // mass portions are redundant with standard conversion — skip
    } else {
      // Unknown unit → treat as a Calibrated Custom Unit
      const customUnit = rawUnit.toLowerCase().trim()
      if (!measurements.some(m => m.unit === customUnit)) {
        const gramsPerUnit = portion.gramWeight / amount
        measurements.push({ unit: customUnit, gramsPerUnit: Math.round(gramsPerUnit * 100) / 100 })
      }
    }
  }

  return { measurements, density }
}

// ---- Food detail fetch ----

export async function fetchFoodDetail(fdcId: number): Promise<USDADetailItem | null> {
  try {
    const apiKey = getApiKey()
    const params = new URLSearchParams({ api_key: apiKey })
    const res = await fetch(`${USDA_BASE}/food/${fdcId}?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return await res.json() as USDADetailItem
  } catch {
    return null
  }
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

// ---- USDA name normalization ----

/**
 * Returns true if a food name still needs USDA normalization.
 * A name is considered raw if it contains a comma outside of parentheses —
 * the hallmark of the USDA comma-reversed format, even after title-casing.
 */
export function isUSDANameRaw(name: string): boolean {
  return name.replace(/\([^)]*\)/g, '').includes(',')
}

const NORMALIZE_SYSTEM_PROMPT = `You are a food name normalizer. Convert raw USDA FoodData Central descriptions into clean, human-readable food names.

Rules:
- Output ONLY the normalized name — no explanation, no punctuation at the end
- Use title case
- NEVER use a comma outside of parentheses in the output — the result must pass a comma-free test outside parens
- The first token(s) form the natural noun; put qualifying details in parentheses after
- Reorder tokens so the name reads naturally in English (e.g. "JAM, FIG" → "Fig Jam", not "Jam (fig)")
- Collapse all comma-separated USDA qualifiers into a single parenthetical suffix when they are true qualifiers rather than part of the noun (e.g. "CHICKEN, BREAST, BONELESS, SKINLESS, RAW" → "Chicken Breast (boneless, skinless, raw)")
- Prenominal adjectives that are inseparable from the noun belong before it, not in parentheses (e.g. "JUICE, ORANGE" → "Orange Juice", "MILK, WHOLE" → "Whole Milk")
- Keep it concise — omit redundant words like "NFS" (not further specified), "NS" (not specified)

Examples:
CHICKEN, BREAST, BONELESS, SKINLESS, RAW → Chicken Breast (boneless, skinless, raw)
JAM, FIG → Fig Jam
BEEF, GROUND, 80% LEAN → Ground Beef (80% lean)
MILK, WHOLE → Whole Milk
JUICE, ORANGE → Orange Juice
BREAD, WHITE → White Bread
OIL, OLIVE → Olive Oil
NUTS, ALMONDS, RAW → Almonds (raw)
CHEESE, CHEDDAR → Cheddar Cheese
SALMON, ATLANTIC, FARMED, RAW → Atlantic Salmon (farmed, raw)`

export async function normalizeUSDAFoodName(rawDescription: string): Promise<string> {
  try {
    const text = await complete({
      systemPrompt: NORMALIZE_SYSTEM_PROMPT,
      userMessage: `<usda_description>${rawDescription}</usda_description>`,
      aiModel: Models.anthropicHaiku,
    })
    if (text) return text
    console.error(`[usda-normalize] Empty response for: ${rawDescription}`)
    return rawDescription
  } catch (err) {
    if (err instanceof AIBudgetExhaustedError) throw err
    console.error(`[usda-normalize] Failed to normalize "${rawDescription}":`, err)
    return rawDescription
  }
}

/**
 * Maps a USDA Foundation/SR Legacy food item to a Food (generic, per 100g).
 * Foundation/SR Legacy nutrients are always expressed per 100g.
 * Does not fetch portions — use importUSDAFood for full import with measurements and density.
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
 * Async import: maps a USDA Foundation/SR Legacy food to a Food, enriched with
 * a normalized name and Measurements and Density derived from foodPortions.
 */
export async function importUSDAFood(item: USDAFoodItem): Promise<Omit<Food, 'id'>> {
  const [base, detail] = await Promise.all([
    Promise.resolve(mapUSDAFoodToFood(item)),
    fetchFoodDetail(item.fdcId),
  ])
  const name = await normalizeUSDAFoodName(item.description)
  const withName = { ...base, name }
  if (!detail?.foodPortions?.length) return withName
  const { measurements, density } = mapPortionsToData(detail.foodPortions)
  return {
    ...withName,
    measurements: [{ unit: 'g' }, ...measurements],
    density,
  }
}

/**
 * Maps a USDA Branded food item to a Product.
 * Branded foods have their own serving size from the label.
 * Nutrients in the USDA Branded database are expressed per 100g and must be scaled.
 * Does not fetch portions — use importUSDABrandedProduct for full import.
 */
export function mapUSDABrandedToProduct(item: USDABrandedItem): Omit<Product, 'id'> {
  const n = item.foodNutrients
  const servingSize = item.servingSize ?? 100
  const servingUnit = item.servingSizeUnit ?? 'g'
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

/**
 * Async import: maps a USDA Branded item to a Product, enriched with
 * Measurements and Density fetched via the internal /api/usda/food/[fdcId] route.
 * Safe to call from client components — no USDA API key is used directly.
 */
export async function importUSDABrandedProduct(item: USDABrandedItem): Promise<Omit<Product, 'id'>> {
  const base = mapUSDABrandedToProduct(item)
  try {
    const res = await fetch(`/api/usda/food/${item.fdcId}`)
    if (!res.ok) return base
    const { measurements, density } = await res.json() as { measurements: Measurement[]; density: number | null }
    return {
      ...base,
      measurements: [{ unit: base.servingUnit }, ...measurements],
      ...(density != null ? { density } : {}),
    }
  } catch {
    return base
  }
}
