import type { Recipe } from '@/types/Recipe'
import { toSlug } from '@/utils/slug'

export type RecipeQueryOptions = {
  ingredient?: string
  published?: boolean
  sortBy?: 'date_published' | 'calories'
  sortDir?: 'asc' | 'desc'
}

export async function apiFetchRecipes(options: RecipeQueryOptions = {}): Promise<Recipe[]> {
  const params = new URLSearchParams()
  if (options.ingredient) params.set('ingredient', options.ingredient)
  if (options.published !== undefined) params.set('published', String(options.published))
  if (options.sortBy) params.set('sortBy', options.sortBy)
  if (options.sortDir) params.set('sortDir', options.sortDir)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/api/recipes${query}`)
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

export async function apiFetchSavedRecipes(): Promise<Recipe[]> {
  const res = await fetch('/api/recipes/saved')
  if (!res.ok) throw new Error('Failed to fetch saved recipes')
  return res.json()
}

export async function apiSaveRecipe(slug: string): Promise<void> {
  const res = await fetch(`/api/recipes/${slug}/save`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to save recipe')
}

export async function apiUnsaveRecipe(slug: string): Promise<void> {
  const res = await fetch(`/api/recipes/${slug}/save`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to unsave recipe')
}

export async function apiIsRecipeSaved(slug: string): Promise<boolean> {
  const res = await fetch(`/api/recipes/${slug}/save`)
  if (!res.ok) return false
  const data = await res.json()
  return data.saved
}
