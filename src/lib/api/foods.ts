import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export async function apiFetchFoods(): Promise<Food[]> {
  const res = await fetch('/api/foods')
  if (!res.ok) throw new Error('Failed to fetch foods')
  return res.json()
}

export async function apiFetchFood(slug: string): Promise<Food | null> {
  const res = await fetch(`/api/foods/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch food')
  return res.json()
}

export async function apiCreateFood(data: Omit<Food, 'id'>): Promise<Food> {
  const res = await fetch('/api/foods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create food')
  return res.json()
}

export async function apiUpdateFood(food: Food): Promise<Food> {
  const slug = toSlug(food.name)
  const res = await fetch(`/api/foods/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(food),
  })
  if (!res.ok) throw new Error('Failed to update food')
  return res.json()
}

export async function apiDeleteFood(slug: string): Promise<void> {
  const res = await fetch(`/api/foods/${slug}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete food')
}
