/**
 * In-memory food data store.
 * Replace the functions below with real database calls when a DB is connected.
 */
import type { Food } from '@/types/Food'
import { getInitialFoods } from '@/stores/initialData'
import { toSlug } from '@/utils/slug'

// Module-level in-memory store initialised from seed data
let foods: Food[] = getInitialFoods()

export async function getFoods(): Promise<Food[]> {
  return foods
}

export async function getFoodBySlug(slug: string): Promise<Food | null> {
  return foods.find((f) => toSlug(f.name) === slug) ?? null
}

export async function getFoodById(id: number): Promise<Food | null> {
  return foods.find((f) => f.id === id) ?? null
}

export async function createFood(data: Omit<Food, 'id'>): Promise<Food> {
  const id = foods.length > 0 ? Math.max(...foods.map((f) => f.id)) + 1 : 1
  const food: Food = { ...data, id }
  foods = [...foods, food]
  return food
}

export async function updateFood(id: number, data: Partial<Omit<Food, 'id'>>): Promise<Food | null> {
  const index = foods.findIndex((f) => f.id === id)
  if (index === -1) return null
  const updated: Food = { ...foods[index], ...data }
  foods = [...foods.slice(0, index), updated, ...foods.slice(index + 1)]
  return updated
}

export async function deleteFood(id: number): Promise<boolean> {
  const before = foods.length
  foods = foods.filter((f) => f.id !== id)
  return foods.length < before
}
