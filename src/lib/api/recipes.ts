import { apiFetch, ensureOk } from './errors'
import type { Recipe, CreateRecipeInput } from '@/types/Recipe'
import type { RecipeStep } from '@/types/RecipeStep'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

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
  const res = await apiFetch(`/api/recipes${query}`)
  await ensureOk(res, 'Failed to fetch recipes')
  return res.json()
}

export async function apiFetchRecipe(shortId: string): Promise<Recipe | null> {
  const res = await apiFetch(`/api/recipes/${shortId}`)
  if (res.status === 404) return null
  await ensureOk(res, 'Failed to fetch recipe')
  return res.json()
}

export async function apiCreateRecipe(data: CreateRecipeInput): Promise<Recipe> {
  const res = await apiFetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to create recipe')
  return res.json()
}

export async function apiUpdateRecipe(recipe: Recipe): Promise<Recipe> {
  const res = await apiFetch(`/api/recipes/${recipe.shortId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  })
  await ensureOk(res, 'Failed to update recipe')
  return res.json()
}

// Sends only the given fields. Use this where the caller holds a list-view recipe (no ingredients):
// the server replaces a recipe's ingredients whenever the body has an `ingredients` key.
export async function apiPatchRecipe(shortId: string, patch: Partial<Omit<Recipe, 'id'>>): Promise<Recipe> {
  const res = await apiFetch(`/api/recipes/${shortId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  await ensureOk(res, 'Failed to update recipe')
  return res.json()
}

export async function apiDeleteRecipe(shortId: string): Promise<void> {
  const res = await apiFetch(`/api/recipes/${shortId}`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to delete recipe', [204])
}

export async function apiFetchSavedRecipes(): Promise<Recipe[]> {
  const res = await apiFetch('/api/recipes/saved')
  await ensureOk(res, 'Failed to fetch saved recipes')
  return res.json()
}

export async function apiSaveRecipe(shortId: string): Promise<void> {
  const res = await apiFetch(`/api/recipes/${shortId}/save`, { method: 'POST' })
  await ensureOk(res, 'Failed to save recipe')
}

export async function apiUnsaveRecipe(shortId: string): Promise<void> {
  const res = await apiFetch(`/api/recipes/${shortId}/save`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to unsave recipe')
}

export async function apiIsRecipeSaved(shortId: string): Promise<boolean> {
  const res = await apiFetch(`/api/recipes/${shortId}/save`)
  if (!res.ok) return false
  const data = await res.json()
  return data.saved
}

export async function apiFetchRecipeSteps(shortId: string): Promise<RecipeStep[]> {
  const res = await apiFetch(`/api/recipes/${shortId}/steps`)
  await ensureOk(res, 'Failed to fetch steps')
  return res.json()
}

export async function apiCreateRecipeStep(shortId: string, data: { title?: string; content: string }): Promise<RecipeStep> {
  const res = await apiFetch(`/api/recipes/${shortId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to create step')
  return res.json()
}

export async function apiUpdateRecipeStep({ shortId, stepId, data }: { shortId: string; stepId: number; data: { title?: string | null; content?: string } }): Promise<RecipeStep> {
  const res = await apiFetch(`/api/recipes/${shortId}/steps/${stepId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to update step')
  return res.json()
}

export async function apiDeleteRecipeStep(shortId: string, stepId: number): Promise<void> {
  const res = await apiFetch(`/api/recipes/${shortId}/steps/${stepId}`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to delete step', [204])
}

export async function apiReorderRecipeSteps(shortId: string, orderedIds: number[]): Promise<void> {
  const res = await apiFetch(`/api/recipes/${shortId}/steps`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  })
  await ensureOk(res, 'Failed to reorder steps', [204])
}

export async function apiUploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiFetch('/api/upload', { method: 'POST', body: formData })
  await ensureOk(res, 'Failed to upload image')
  const data = await res.json()
  return data.url
}

export async function apiScrapeRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const res = await apiFetch('/api/recipes/url-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  await ensureOk(res, 'Failed to scrape recipe')
  return res.json()
}