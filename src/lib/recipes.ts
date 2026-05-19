import { eq, isNull, isNotNull, and, or, exists, asc, desc, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { recipes, ingredients, foods, savedRecipes } from '@/db/schema'
import type { Recipe } from '@/types/Recipe'
import type { Ingredient } from '@/types/Ingredient'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'

export type RecipeQueryOptions = {
  ingredient?: string
  published?: boolean
  sortBy?: 'date_published' | 'calories'
  sortDir?: 'asc' | 'desc'
  viewerId?: number
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
    .where(
      and(
        eq(ingredients.recipeId, recipeId),
        isNull(ingredients.dateDeleted),
        isNull(foods.dateDeleted)
      )
    )
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
    userId: row.userId ?? null,
    isPublic: row.isPublic === 1,
  }
}

export async function getRecipes(options: RecipeQueryOptions = {}): Promise<Recipe[]> {
  try {
    const visibilityFilter = options.viewerId !== undefined
      ? or(eq(recipes.isPublic, 1), eq(recipes.userId, options.viewerId))
      : eq(recipes.isPublic, 1)

    const ingredientFilter = options.ingredient
      ? exists(
          db.select({ one: eq(ingredients.recipeId, recipes.id) })
            .from(ingredients)
            .innerJoin(foods, eq(ingredients.foodId, foods.id))
            .where(and(
              eq(ingredients.recipeId, recipes.id),
              isNull(ingredients.dateDeleted),
              isNull(foods.dateDeleted),
              ilike(foods.name, `%${options.ingredient}%`)
            ))
        )
      : undefined

    const publishedFilter = options.published !== undefined
      ? (options.published ? isNotNull(recipes.datePublished) : isNull(recipes.datePublished))
      : undefined

    const baseQuery = db.select().from(recipes).where(
      and(isNull(recipes.dateDeleted), visibilityFilter, publishedFilter, ingredientFilter)
    )

    const orderedQuery = options.sortBy === 'date_published'
      ? baseQuery.orderBy(options.sortDir === 'desc' ? desc(recipes.datePublished) : asc(recipes.datePublished))
      : baseQuery

    const rows = await orderedQuery
    const built = await Promise.all(rows.map(buildRecipe))

    if (options.sortBy === 'calories') {
      built.sort((a, b) => {
        const calsA = a.ingredients.reduce((s, i) => s + (i.calories || 0), 0)
        const calsB = b.ingredients.reduce((s, i) => s + (i.calories || 0), 0)
        return options.sortDir === 'desc' ? calsB - calsA : calsA - calsB
      })
    }

    return built
  } catch {
    return []
  }
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  const [row] = await db.select().from(recipes).where(and(eq(recipes.slug, slug), isNull(recipes.dateDeleted)))
  return row ? buildRecipe(row) : null
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  const [row] = await db.select().from(recipes).where(and(eq(recipes.id, id), isNull(recipes.dateDeleted)))
  return row ? buildRecipe(row) : null
}

export async function createRecipe(data: Omit<Recipe, 'id'>): Promise<Recipe> {
  const [row] = await db.insert(recipes).values({
    name: data.name,
    slug: toSlug(data.name),
    meal: data.meal,
    description: data.description,
    isPublic: data.isPublic ? 1 : 0,
    userId: data.userId ?? null,
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
  if (data.name !== undefined) {
    updates.name = data.name
    updates.slug = toSlug(data.name)
  }
  if (data.meal !== undefined) updates.meal = data.meal
  if (data.description !== undefined) updates.description = data.description
  if (data.date_published !== undefined) updates.datePublished = data.date_published ? new Date(data.date_published) : null
  if (data.isPublic !== undefined) updates.isPublic = data.isPublic ? 1 : 0

  const [row] = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning()
  if (!row) return null

  // Revoke saved bookmarks when recipe is made private
  if (data.isPublic === false) {
    await db.update(savedRecipes)
      .set({ dateDeleted: new Date() })
      .where(and(eq(savedRecipes.recipeId, id), isNull(savedRecipes.dateDeleted)))
  }

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

export async function saveRecipe(userId: number, recipeId: number): Promise<void> {
  await db.insert(savedRecipes)
    .values({ userId, recipeId })
    .onConflictDoUpdate({
      target: [savedRecipes.userId, savedRecipes.recipeId],
      set: { dateDeleted: null, dateSaved: new Date() },
    })
}

export async function unsaveRecipe(userId: number, recipeId: number): Promise<void> {
  await db.update(savedRecipes)
    .set({ dateDeleted: new Date() })
    .where(and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId), isNull(savedRecipes.dateDeleted)))
}

export async function getSavedRecipes(userId: number): Promise<Recipe[]> {
  const rows = await db.select({ recipe: recipes }).from(savedRecipes)
    .innerJoin(recipes, eq(savedRecipes.recipeId, recipes.id))
    .where(
      and(
        eq(savedRecipes.userId, userId),
        isNull(savedRecipes.dateDeleted),
        isNull(recipes.dateDeleted),
        eq(recipes.isPublic, 1), // defense-in-depth: exclude if recipe was made private without going through updateRecipe
      )
    )
  return Promise.all(rows.map(r => buildRecipe(r.recipe)))
}

export async function isSaved(userId: number, recipeId: number): Promise<boolean> {
  const [row] = await db.select().from(savedRecipes).where(
    and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId), isNull(savedRecipes.dateDeleted))
  )
  return !!row
}
