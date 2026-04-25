import type { Recipe } from '@/types/Recipe'
import { toSlug } from '@/utils/slug'

export async function apiFetchRecipes(): Promise<Recipe[]> {
  const res = await fetch('/api/recipes')
  if (!res.ok) throw new Error('Failed to fetch recipes')
  return res.json()
}

export async function apiFetchRecipe(slug: string): Promise<Recipe | null> {
  const res = await fetch(`/api/recipes/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch recipe')
  return res.json()
}

export async function apiCreateRecipe(data: Omit<Recipe, 'id'>): Promise<Recipe> {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create recipe')
  return res.json()
}

export async function apiUpdateRecipe(recipe: Recipe): Promise<Recipe> {
  const slug = toSlug(recipe.name)
  const res = await fetch(`/api/recipes/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  })
  if (!res.ok) throw new Error('Failed to update recipe')
  return res.json()
}

export async function apiDeleteRecipe(slug: string): Promise<void> {
  const res = await fetch(`/api/recipes/${slug}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete recipe')
}
