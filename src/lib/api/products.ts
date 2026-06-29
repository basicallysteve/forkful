import type { Product } from '@/types/Product'

export async function apiFetchProducts(options: { search?: string } = {}): Promise<Product[]> {
  const params = new URLSearchParams()
  if (options.search) params.set('search', options.search)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/api/products${query}`)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export async function apiFetchProduct(slug: string): Promise<Product | null> {
  const res = await fetch(`/api/products/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch product')
  return res.json()
}

export async function apiCreateProduct(data: Omit<Product, 'id'>): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to create product')
  return res.json()
}

export async function apiUpdateProduct(currentSlug: string, product: Product): Promise<Product> {
  const res = await fetch(`/api/products/${currentSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to update product')
  return res.json()
}

export async function apiFetchProductByBarcode(barcode: string): Promise<Product | null> {
  const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Barcode lookup failed')
  return res.json()
}

export async function apiLinkProductToFood(productSlug: string, foodId: number): Promise<void> {
  const res = await fetch(`/api/products/${productSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentFoodId: foodId }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to link product to food')
}

export async function apiDeleteProduct(slug: string): Promise<void> {
  const res = await fetch(`/api/products/${slug}`, { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete product')
}
