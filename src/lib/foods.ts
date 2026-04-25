import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import { db } from '@/db'
import { foods } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getFoods() {
  return await db.select().from(foods)
}

export async function getFoodBySlug(slug: string) {
  // Note: For better performance at scale, consider adding a 'slug' column to your database schema
  // so you can query it directly using Drizzle instead of fetching all records.
  const allFoods = await db.select().from(foods)
  return allFoods.find((f) => toSlug(f.name) === slug) ?? null
}

export async function getFoodById(id: number) {
  const [food] = await db.select().from(foods).where(eq(foods.id, id))
  return food ?? null
}

export async function createFood(data: Omit<Food, 'id'>) {
  const [newFood] = await db.insert(foods).values(data).returning()
  return newFood
}

export async function updateFood(id: number, data: Partial<Omit<Food, 'id'>>) {
  const [updatedFood] = await db.update(foods).set(data).where(eq(foods.id, id)).returning()
  return updatedFood ?? null
}

export async function deleteFood(id: number) {
  const deletedFoods = await db.delete(foods).where(eq(foods.id, id)).returning()
  return deletedFoods.length > 0
}
