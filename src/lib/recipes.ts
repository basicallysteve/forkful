/**
 * In-memory recipe data store.
 * Replace the functions below with real database calls when a DB is connected.
 */
import type { Recipe } from '@/types/Recipe'
import { getInitialRecipes } from '@/stores/initialData'
import { toSlug } from '@/utils/slug'

// Module-level in-memory store initialised from seed data
let recipes: Recipe[] = getInitialRecipes()

export async function getRecipes(): Promise<Recipe[]> {
  return recipes
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  return recipes.find((r) => toSlug(r.name) === slug) ?? null
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  return recipes.find((r) => r.id === id) ?? null
}

export async function createRecipe(data: Omit<Recipe, 'id'>): Promise<Recipe> {
  const id = recipes.length > 0 ? Math.max(...recipes.map((r) => r.id)) + 1 : 1
  const recipe: Recipe = { ...data, id }
  recipes = [...recipes, recipe]
  return recipe
}

export async function updateRecipe(id: number, data: Partial<Omit<Recipe, 'id'>>): Promise<Recipe | null> {
  const index = recipes.findIndex((r) => r.id === id)
  if (index === -1) return null
  const updated: Recipe = { ...recipes[index], ...data }
  recipes = [...recipes.slice(0, index), updated, ...recipes.slice(index + 1)]
  return updated
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const before = recipes.length
  recipes = recipes.filter((r) => r.id !== id)
  return recipes.length < before
}
