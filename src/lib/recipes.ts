import { eq, isNull, isNotNull, and, or, exists, asc, desc, ilike, count, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { recipes, ingredients, foods, savedRecipes, recipeSteps } from '@/db/schema'
import type { Recipe } from '@/types/Recipe'
import type { RecipeStep } from '@/types/RecipeStep'
import type { Ingredient } from '@/types/Ingredient'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import { sanitizeRichText } from '@/lib/sanitize'

export type RecipeQueryOptions = {
  user_id?: number
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

function mapStep(row: typeof recipeSteps.$inferSelect): RecipeStep {
  return {
    id: row.id,
    recipeId: row.recipeId,
    position: row.position,
    title: row.title ?? null,
    content: row.content,
    dateAdded: row.dateAdded ?? undefined,
  }
}

async function buildSteps(recipeId: number): Promise<RecipeStep[]> {
  const rows = await db
    .select()
    .from(recipeSteps)
    .where(and(eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    .orderBy(asc(recipeSteps.position))
  return rows.map(mapStep)
}

function mapRecipeRow(
  row: typeof recipes.$inferSelect,
  ingredientList: Ingredient[],
  stepList: RecipeStep[],
): Recipe {
  return {
    id: row.id,
    name: row.name,
    meal: row.meal as Recipe['meal'] | undefined,
    description: row.description ?? '',
    ingredients: ingredientList,
    steps: stepList,
    prepTime: row.prepTime ?? null,
    cookTime: row.cookTime ?? null,
    totalTime: row.totalTime ?? null,
    cuisineType: row.cuisineType ?? null,
    dietaryTags: (row.dietaryTags as string[] | null) ?? [],
    date_added: row.dateAdded ?? undefined,
    date_published: row.datePublished ?? null,
    userId: row.userId ?? null,
    isPublic: row.isPublic === 1,
  }
}

async function buildRecipe(row: typeof recipes.$inferSelect): Promise<Recipe> {
  const [ingredientList, stepList] = await Promise.all([
    buildIngredients(row.id),
    buildSteps(row.id),
  ])
  return mapRecipeRow(row, ingredientList, stepList)
}

// Fetch ingredients and steps for multiple recipes in 2 queries instead of 2N.
async function buildRecipesBatch(rows: (typeof recipes.$inferSelect)[]): Promise<Recipe[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [allIngredients, allSteps] = await Promise.all([
    db
      .select()
      .from(ingredients)
      .innerJoin(foods, eq(ingredients.foodId, foods.id))
      .where(and(inArray(ingredients.recipeId, ids), isNull(ingredients.dateDeleted), isNull(foods.dateDeleted))),
    db
      .select()
      .from(recipeSteps)
      .where(and(inArray(recipeSteps.recipeId, ids), isNull(recipeSteps.dateDeleted)))
      .orderBy(asc(recipeSteps.position)),
  ])

  const ingredientsByRecipe = new Map<number, Ingredient[]>(ids.map((id) => [id, []]))
  const stepsByRecipe = new Map<number, RecipeStep[]>(ids.map((id) => [id, []]))

  for (const row of allIngredients) {
    ingredientsByRecipe.get(row.ingredients.recipeId)?.push({
      food: mapFood(row.foods),
      quantity: Number(row.ingredients.quantity),
      calories: row.ingredients.calories,
      servingUnit: row.ingredients.servingUnit ?? row.foods.servingUnit ?? 'g',
    })
  }

  for (const row of allSteps) {
    stepsByRecipe.get(row.recipeId)?.push(mapStep(row))
  }

  return rows.map((row) =>
    mapRecipeRow(row, ingredientsByRecipe.get(row.id) ?? [], stepsByRecipe.get(row.id) ?? [])
  )
}

export async function getRecipes(options: RecipeQueryOptions = {}): Promise<Recipe[]> {
  try {
    // Others' recipes are only visible when public AND published.
    // Own recipes are always visible regardless of published status.
    const othersFilter = and(eq(recipes.isPublic, 1), isNotNull(recipes.datePublished))
    const visibilityFilter = options.viewerId !== undefined
      ? or(othersFilter, eq(recipes.userId, options.viewerId))
      : othersFilter

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

    // When published filter is set with a viewerId, scope it to own recipes only —
    // others' recipes are already constrained to published via othersFilter.
    const publishedFilter = options.published !== undefined
      ? (options.viewerId !== undefined
          ? or(
              othersFilter,
              and(
                eq(recipes.userId, options.viewerId),
                options.published ? isNotNull(recipes.datePublished) : isNull(recipes.datePublished)
              )
            )
          : (options.published ? isNotNull(recipes.datePublished) : isNull(recipes.datePublished)))
      : undefined

    const baseQuery = db.select().from(recipes).where(
      and(isNull(recipes.dateDeleted), publishedFilter ?? visibilityFilter, ingredientFilter)
    )

    const orderedQuery = options.sortBy === 'date_published'
      ? baseQuery.orderBy(options.sortDir === 'desc' ? desc(recipes.datePublished) : asc(recipes.datePublished))
      : baseQuery

    const rows = await orderedQuery
    const built = await buildRecipesBatch(rows)

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

export async function getRecipeBySlug(slug: string, viewerId?: number): Promise<Recipe | null> {
  const visibilityFilter = viewerId !== undefined
    ? or(eq(recipes.isPublic, 1), eq(recipes.userId, viewerId))
    : eq(recipes.isPublic, 1)
  const [row] = await db.select().from(recipes).where(
    and(eq(recipes.slug, slug), isNull(recipes.dateDeleted), visibilityFilter)
  )
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
    prepTime: data.prepTime ?? null,
    cookTime: data.cookTime ?? null,
    totalTime: data.totalTime ?? null,
    cuisineType: data.cuisineType ?? null,
    dietaryTags: data.dietaryTags ?? [],
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
  if (data.prepTime !== undefined) updates.prepTime = data.prepTime
  if (data.cookTime !== undefined) updates.cookTime = data.cookTime
  if (data.totalTime !== undefined) updates.totalTime = data.totalTime
  if (data.cuisineType !== undefined) updates.cuisineType = data.cuisineType
  if (data.dietaryTags !== undefined) updates.dietaryTags = data.dietaryTags
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

export async function getSavedRecipes(userId: number, limit?: number): Promise<Recipe[]> {
  let query = db.select({ recipe: recipes }).from(savedRecipes)
    .innerJoin(recipes, eq(savedRecipes.recipeId, recipes.id))
    .where(
      and(
        eq(savedRecipes.userId, userId),
        isNull(savedRecipes.dateDeleted),
        isNull(recipes.dateDeleted),
        eq(recipes.isPublic, 1), // defense-in-depth: exclude if recipe was made private without going through updateRecipe
      )
    )
    .orderBy(desc(savedRecipes.dateSaved))
  if (limit !== undefined) query = query.limit(limit) as typeof query
  const rows = await query
  return buildRecipesBatch(rows.map((r) => r.recipe))
}

export async function getTopRecipes(limit = 3): Promise<Recipe[]> {
  try {
    const rows = await db
      .select({ recipe: recipes, saveCount: count(savedRecipes.id) })
      .from(recipes)
      .leftJoin(savedRecipes, and(eq(savedRecipes.recipeId, recipes.id), isNull(savedRecipes.dateDeleted)))
      .where(and(isNull(recipes.dateDeleted), eq(recipes.isPublic, 1), isNotNull(recipes.datePublished)))
      .groupBy(recipes.id)
      .orderBy(desc(count(savedRecipes.id)), desc(recipes.datePublished))
      .limit(limit)
    return buildRecipesBatch(rows.map((r) => r.recipe))
  } catch {
    return []
  }
}

export async function isSaved(userId: number, recipeId: number): Promise<boolean> {
  const [row] = await db.select().from(savedRecipes).where(
    and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId), isNull(savedRecipes.dateDeleted))
  )
  return !!row
}

export async function getRecipeSteps(recipeId: number): Promise<RecipeStep[]> {
  const rows = await db
    .select()
    .from(recipeSteps)
    .where(and(eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    .orderBy(asc(recipeSteps.position))
  return rows.map(mapStep)
}

export async function createRecipeStep(recipeId: number, data: { title?: string; content: string }): Promise<RecipeStep> {
  const [maxRow] = await db
    .select({ maxPos: recipeSteps.position })
    .from(recipeSteps)
    .where(and(eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    .orderBy(desc(recipeSteps.position))
    .limit(1)
  const nextPosition = maxRow ? maxRow.maxPos + 1 : 0
  const [row] = await db.insert(recipeSteps).values({
    recipeId,
    position: nextPosition,
    title: data.title ?? null,
    content: sanitizeRichText(data.content),
  }).returning()
  return mapStep(row)
}

export async function updateRecipeStep(stepId: number, recipeId: number, data: { title?: string | null; content?: string }): Promise<RecipeStep | null> {
  const updates: Partial<typeof recipeSteps.$inferInsert> = {}
  if (data.title !== undefined) updates.title = data.title
  if (data.content !== undefined) updates.content = sanitizeRichText(data.content)
  const [row] = await db
    .update(recipeSteps)
    .set(updates)
    .where(and(eq(recipeSteps.id, stepId), eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    .returning()
  return row ? mapStep(row) : null
}

export async function deleteRecipeStep(stepId: number, recipeId: number): Promise<boolean> {
  const updated = await db
    .update(recipeSteps)
    .set({ dateDeleted: new Date() })
    .where(and(eq(recipeSteps.id, stepId), eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    .returning()
  return updated.length > 0
}

export async function reorderRecipeSteps(recipeId: number, orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(recipeSteps)
        .set({ position: i })
        .where(and(eq(recipeSteps.id, orderedIds[i]), eq(recipeSteps.recipeId, recipeId), isNull(recipeSteps.dateDeleted)))
    }
  })
}

export async function getForYouRecipes(cuisinePreferences: string[], limit = 5): Promise<Recipe[]> {
  if (cuisinePreferences.length === 0) return []
  try {
    const rows = await db
      .select()
      .from(recipes)
      .where(
        and(
          isNull(recipes.dateDeleted),
          eq(recipes.isPublic, 1),
          isNotNull(recipes.datePublished),
          inArray(recipes.cuisineType, cuisinePreferences)
        )
      )
      .orderBy(desc(recipes.datePublished))
      .limit(limit)
    return buildRecipesBatch(rows)
  } catch {
    return []
  }
}
