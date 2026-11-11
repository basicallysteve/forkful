import type { OFFProduct } from '@/types/OpenFoodFacts'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'

const OFF_BASE = 'https://world.openfoodfacts.org'
const USER_AGENT = 'EatForkful/1.0 (https://eatforkful.com)'

interface OFFSearchResponse {
  products: OFFProduct[]
  count: number
}

interface OFFProductResponse {
  product: OFFProduct
  status: number
}

export async function searchOpenFoodFacts(query: string): Promise<OFFProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    json: '1',
    page_size: '10',
    fields: 'code,product_name,nutriments,serving_size,serving_quantity,brands',
  })

  const res = await fetch(`${OFF_BASE}/cgi/search.pl?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 60 },
  })

  if (!res.ok) throw new Error(`OpenFoodFacts search failed: ${res.status}`)

  const data: OFFSearchResponse = await res.json()
  return (data.products ?? []).filter((p) => p.product_name)
}

export async function getOpenFoodFactsProduct(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(
    `${OFF_BASE}/api/v2/product/${barcode}.json?fields=code,product_name,nutriments,serving_size,serving_quantity,brands`,
    { headers: { 'User-Agent': USER_AGENT } }
  )

  if (!res.ok) return null

  const data: OFFProductResponse = await res.json()
  if (data.status !== 1 || !data.product?.product_name) return null
  return data.product
}

/**
 * Parse a gram value from an OFF product's serving fields.
 * Prefers the numeric serving_quantity (already in grams) over parsing the string.
 * Returns 100 when grams cannot be determined (non-gram units like "1 capsule", "250ml").
 */
function parseServingGrams(servingSize?: string, servingQuantity?: number): number {
  // serving_quantity is in the product's main unit — grams for solid, ml for liquid.
  // Only trust it when the serving is not volume-based.
  const isVolumeServing = servingSize ? /\d\s*(?:ml|fl[\s-]?oz|cl|dl|l\b)/i.test(servingSize) : false
  if (!isVolumeServing && servingQuantity && servingQuantity > 0) return servingQuantity
  if (servingSize) {
    // Match patterns like "30g", "30 g", "30.5g", "1 piece (30g)" — excludes "mg"
    const match = servingSize.match(/(\d+(?:\.\d+)?)\s*g(?!\w)/)
    if (match) return parseFloat(match[1])
  }
  return 100
}

export function mapOFFProductToFood(product: OFFProduct): Omit<Food, 'id'> {
  const n = product.nutriments ?? {}
  const kcal100g = n['energy-kcal_100g'] ?? 0
  const protein100g = n['proteins_100g'] ?? 0
  const carbs100g = n['carbohydrates_100g'] ?? 0
  const sugar100g = n['sugars_100g']
  const fat100g = n['fat_100g'] ?? 0
  const saturatedFat100g = n['saturated-fat_100g']
  const fiber100g = n['fiber_100g'] ?? 0
  const sodium100g = n['sodium_100g']

  // Prefer the numeric serving_quantity from OFF (already in grams); fall back to
  // parsing the human-readable serving_size string; default to 100g.
  const servingGrams = parseServingGrams(product.serving_size, product.serving_quantity)
  const scale = servingGrams / 100

  return {
    name: product.product_name,
    calories: Math.round(kcal100g * scale),
    protein: Math.round(protein100g * scale * 10) / 10,
    carbs: Math.round(carbs100g * scale * 10) / 10,
    sugar: sugar100g != null ? Math.round(sugar100g * scale * 10) / 10 : undefined,
    fat: Math.round(fat100g * scale * 10) / 10,
    saturatedFat: saturatedFat100g != null ? Math.round(saturatedFat100g * scale * 10) / 10 : undefined,
    fiber: Math.round(fiber100g * scale * 10) / 10,
    sodium: sodium100g != null ? Math.round(sodium100g * scale * 1000) : undefined, // g→mg
    servingSize: servingGrams,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }],
    externalId: product.code || undefined,
    source: 'open_food_facts' as const,
  }
}

/**
 * Maps an OFF product to the Product type (for pantry barcode flow).
 * OFF products are branded items tracked in the pantry, not generic Foods.
 */
export function mapOFFProductToProduct(product: OFFProduct): Omit<Product, 'id'> {
  const n = product.nutriments ?? {}
  const kcal100g = n['energy-kcal_100g'] ?? 0
  const protein100g = n['proteins_100g'] ?? 0
  const carbs100g = n['carbohydrates_100g'] ?? 0
  const sugar100g = n['sugars_100g']
  const fat100g = n['fat_100g'] ?? 0
  const saturatedFat100g = n['saturated-fat_100g']
  const fiber100g = n['fiber_100g'] ?? 0
  const sodium100g = n['sodium_100g']

  const servingGrams = parseServingGrams(product.serving_size, product.serving_quantity)
  const scale = servingGrams / 100

  return {
    name: product.product_name,
    barcode: product.code || undefined,
    externalId: product.code || undefined,
    calories: Math.round(kcal100g * scale),
    protein: Math.round(protein100g * scale * 10) / 10,
    carbs: Math.round(carbs100g * scale * 10) / 10,
    sugar: sugar100g != null ? Math.round(sugar100g * scale * 10) / 10 : undefined,
    fat: Math.round(fat100g * scale * 10) / 10,
    saturatedFat: saturatedFat100g != null ? Math.round(saturatedFat100g * scale * 10) / 10 : undefined,
    fiber: Math.round(fiber100g * scale * 10) / 10,
    sodium: sodium100g != null ? Math.round(sodium100g * scale * 1000) : undefined, // g→mg
    servingSize: servingGrams,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }],
    source: 'open_food_facts' as const,
  }
}
