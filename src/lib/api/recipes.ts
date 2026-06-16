import type { Recipe, CreateRecipeInput } from '@/types/Recipe'
import type { RecipeStep } from '@/types/RecipeStep'

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

export async function apiFetchRecipe(shortId: string): Promise<Recipe | null> {
  const res = await fetch(`/api/recipes/${shortId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch recipe')
  return res.json()
}

export async function apiCreateRecipe(data: CreateRecipeInput): Promise<Recipe> {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create recipe')
  return res.json()
}

export async function apiUpdateRecipe(recipe: Recipe): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${recipe.shortId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  })
  if (!res.ok) throw new Error('Failed to update recipe')
  return res.json()
}

export async function apiDeleteRecipe(shortId: string): Promise<void> {
  const res = await fetch(`/api/recipes/${shortId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete recipe')
}

export async function apiFetchSavedRecipes(): Promise<Recipe[]> {
  const res = await fetch('/api/recipes/saved')
  if (!res.ok) throw new Error('Failed to fetch saved recipes')
  return res.json()
}

export async function apiSaveRecipe(shortId: string): Promise<void> {
  const res = await fetch(`/api/recipes/${shortId}/save`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to save recipe')
}

export async function apiUnsaveRecipe(shortId: string): Promise<void> {
  const res = await fetch(`/api/recipes/${shortId}/save`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to unsave recipe')
}

export async function apiIsRecipeSaved(shortId: string): Promise<boolean> {
  const res = await fetch(`/api/recipes/${shortId}/save`)
  if (!res.ok) return false
  const data = await res.json()
  return data.saved
}

export async function apiFetchRecipeSteps(shortId: string): Promise<RecipeStep[]> {
  const res = await fetch(`/api/recipes/${shortId}/steps`)
  if (!res.ok) throw new Error('Failed to fetch steps')
  return res.json()
}

export async function apiCreateRecipeStep(shortId: string, data: { title?: string; content: string }): Promise<RecipeStep> {
  const res = await fetch(`/api/recipes/${shortId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create step')
  return res.json()
}

export async function apiUpdateRecipeStep(shortId: string, stepId: number, data: { title?: string | null; content?: string }): Promise<RecipeStep> {
  const res = await fetch(`/api/recipes/${shortId}/steps/${stepId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update step')
  return res.json()
}

export async function apiDeleteRecipeStep(shortId: string, stepId: number): Promise<void> {
  const res = await fetch(`/api/recipes/${shortId}/steps/${stepId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete step')
}

export async function apiReorderRecipeSteps(shortId: string, orderedIds: number[]): Promise<void> {
  const res = await fetch(`/api/recipes/${shortId}/steps`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  })
  if (!res.ok && res.status !== 204) throw new Error('Failed to reorder steps')
}

export async function apiUploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Failed to upload image')
  const data = await res.json()
  return data.url
}
