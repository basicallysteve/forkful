import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'


export async function apiCreateFood(data: Omit<Food, 'id'>): Promise<Food> {
  const res = await fetch('/api/foods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })

  console.log('Create Food Response:', res)
  if (!res.ok) throw new Error('Failed to create food')
  return res.json()
}

export async function apiUpdateFood(food: Food): Promise<Food> {
  const slug = toSlug(food.name)
  const res = await fetch(`/api/foods/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(food),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to update food')
  return res.json()
}

export async function apiDeleteFood(slug: string): Promise<void> {
  const res = await fetch(`/api/foods/${slug}`, { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete food')
}
