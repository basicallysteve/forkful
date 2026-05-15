import type { OFFProduct } from '@/types/OpenFoodFacts'
import type { Food } from '@/types/Food'

export async function apiSearchOpenFoodFacts(query: string): Promise<OFFProduct[]> {
  const res = await fetch(`/api/openfoodfacts/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  const data = await res.json()
  return data.products ?? []
}

export async function apiGetProductByBarcode(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(`/api/openfoodfacts/barcode/${encodeURIComponent(barcode)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Barcode lookup failed')
  const data = await res.json()
  return data.product ?? null
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

  const servingGrams = product.serving_quantity ?? 100
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
    measurements: ['g'],
    barcode: product.code || undefined,
    source: 'open_food_facts' as const,
  }
}
