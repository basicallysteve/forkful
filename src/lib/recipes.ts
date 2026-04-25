import { eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { recipes, ingredients, foods } from '@/db/schema'
import type { Recipe } from '@/types/Recipe'
import type { Ingredient } from '@/types/Ingredient'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export type RecipeQueryOptions = {
  ingredient?: string
  published?: boolean
  sortBy?: 'date_published' | 'calories'
  sortDir?: 'asc' | 'desc'
}

function mapFood(row: typeof foods.$inferSelect): Food {
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    servingSize: Number(row.servingSize ?? 1),
    servingUnit: row.servingUnit ?? undefined,
    measurements: (row.measurements as string[] | null) ?? [],
  }
}

async function buildIngredients(recipeId: number): Promise<Ingredient[]> {
  const rows = await db
    .select()
    .from(ingredients)
    .innerJoin(foods, eq(ingredients.foodId, foods.id))
    .where(eq(ingredients.recipeId, recipeId))
  return rows.map((row) => ({
    food: mapFood(row.foods),
    quantity: Number(row.ingredients.quantity),
    calories: row.ingredients.calories,
    servingUnit: row.ingredients.servingUnit ?? row.foods.servingUnit ?? 'g',
  }))
}

async function buildRecipe(row: typeof recipes.$inferSelect): Promise<Recipe> {
  const ingredientList = await buildIngredients(row.id)
  return {
    id: row.id,
    name: row.name,
    meal: row.meal as Recipe['meal'] | undefined,
    description: row.description ?? '',
    ingredients: ingredientList,
    date_added: row.dateAdded ?? undefined,
    date_published: row.datePublished ?? null,
  }
}

export async function getRecipes(options: RecipeQueryOptions = {}): Promise<Recipe[]> {
  try {
    const rows = await db.select().from(recipes).where(isNull(recipes.dateDeleted))
    const built = await Promise.all(rows.map(buildRecipe))
    let result = built

    if (options.published !== undefined) {
      result = result.filter(r =>
        options.published ? r.date_published !== null : r.date_published === null
      )
    }

    if (options.ingredient) {
      const term = options.ingredient.toLowerCase()
      result = result.filter(r =>
        r.ingredients.some(ing => ing.food.name.toLowerCase().includes(term))
      )
    }

    if (options.sortBy) {
      result = result.sort((a, b) => {
        let cmp = 0
        if (options.sortBy === 'date_published') {
          const dateA = a.date_published ? new Date(a.date_published).getTime() : 0
          const dateB = b.date_published ? new Date(b.date_published).getTime() : 0
          cmp = dateA - dateB
        } else if (options.sortBy === 'calories') {
          const calsA = a.ingredients.reduce((s, i) => s + (i.calories || 0), 0)
          const calsB = b.ingredients.reduce((s, i) => s + (i.calories || 0), 0)
          cmp = calsA - calsB
        }
        return options.sortDir === 'desc' ? -cmp : cmp
      })
    }

    return result
  } catch {
    return []
  }
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  const rows = await db.select().from(recipes)
  const row = rows.find((r) => toSlug(r.name) === slug)
  return row ? buildRecipe(row) : null
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, id))
  return row ? buildRecipe(row) : null
}

export async function createRecipe(data: Omit<Recipe, 'id'>): Promise<Recipe> {
  const [row] = await db.insert(recipes).values({
    name: data.name,
    meal: data.meal,
    description: data.description,
    dateAdded: data.date_added ? new Date(data.date_added) : new Date(),
    datePublished: data.date_published ? new Date(data.date_published) : null,
  }).returning()
  if (data.ingredients && data.ingredients.length > 0) {
    await db.insert(ingredients).values(
      data.ingredients.map((ing) => ({
        recipeId: row.id,
        foodId: ing.food.id,
        quantity: String(ing.quantity),
        calories: ing.calories,
        servingUnit: ing.servingUnit,
      }))
    )
  }
  return buildRecipe(row)
}

export async function updateRecipe(id: number, data: Partial<Omit<Recipe, 'id'>>): Promise<Recipe | null> {
  const updates: Partial<typeof recipes.$inferInsert> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.meal !== undefined) updates.meal = data.meal
  if (data.description !== undefined) updates.description = data.description
  if (data.date_published !== undefined) updates.datePublished = data.date_published ? new Date(data.date_published) : null
  const [row] = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning()
  if (!row) return null
  if (data.ingredients !== undefined) {
    await db.delete(ingredients).where(eq(ingredients.recipeId, id))
    if (data.ingredients.length > 0) {
      await db.insert(ingredients).values(
        data.ingredients.map((ing) => ({
          recipeId: id,
          foodId: ing.food.id,
          quantity: String(ing.quantity),
          calories: ing.calories,
          servingUnit: ing.servingUnit,
        }))
      )
    }
  }
  return buildRecipe(row)
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const updated = await db.update(recipes).set({ dateDeleted: new Date() }).where(eq(recipes.id, id)).returning()
  return updated.length > 0
}
