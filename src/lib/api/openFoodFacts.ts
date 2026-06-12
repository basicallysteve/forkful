import type { OFFProduct } from '@/types/OpenFoodFacts'

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

export { mapOFFProductToFood, mapOFFProductToProduct } from '@/lib/openFoodFacts'
