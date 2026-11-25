import { apiFetch, ensureOk } from './errors'
import type { Product } from '@/types/Product'

export async function apiFetchProducts(options: { search?: string } = {}): Promise<Product[]> {
  const params = new URLSearchParams()
  if (options.search) params.set('search', options.search)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(`/api/products${query}`)
  await ensureOk(res, 'Failed to fetch products')
  return res.json()
}

export async function apiFetchProduct(slug: string): Promise<Product | null> {
  const res = await apiFetch(`/api/products/${slug}`)
  if (res.status === 404) return null
  await ensureOk(res, 'Failed to fetch product')
  return res.json()
}

export async function apiCreateProduct(data: Omit<Product, 'id'>): Promise<Product> {
  const res = await apiFetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })
  await ensureOk(res, 'Failed to create product')
  return res.json()
}

export async function apiUpdateProduct(currentSlug: string, product: Product): Promise<Product> {
  const res = await apiFetch(`/api/products/${currentSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
    credentials: 'same-origin',
  })
  await ensureOk(res, 'Failed to update product')
  return res.json()
}

export async function apiFetchProductByBarcode(barcode: string): Promise<Product | null> {
  const res = await apiFetch(`/api/products/barcode/${encodeURIComponent(barcode)}`)
  if (res.status === 404) return null
  await ensureOk(res, 'Barcode lookup failed')
  return res.json()
}

export async function apiLinkProductToFood(productSlug: string, foodId: number): Promise<void> {
  const res = await apiFetch(`/api/products/${productSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentFoodId: foodId }),
    credentials: 'same-origin',
  })
  await ensureOk(res, 'Failed to link product to food')
}

export async function apiDeleteProduct(slug: string): Promise<void> {
  const res = await apiFetch(`/api/products/${slug}`, { method: 'DELETE', credentials: 'same-origin' })
  await ensureOk(res, 'Failed to delete product', [204])
}
