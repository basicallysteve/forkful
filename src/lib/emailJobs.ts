import { eq, and, isNull, lte, gte, inArray, isNotNull, desc } from 'drizzle-orm'
import { db } from '@/db'
import { users, pantryItems, foods, recipes, ingredients } from '@/db/schema'
import { sendPantryReminderEmail, sendRecipeSuggestionEmail } from '@/lib/email'

export async function processPantryReminders(frequency: 'daily' | 'weekly'): Promise<{ sent: number }> {
  const now = new Date()
  const windowDays = frequency === 'daily' ? 1 : 7
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

  const eligibleUsers = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(and(
      isNull(users.dateDeleted),
      eq(users.pantryExpirationFrequency, frequency),
    ))

  if (eligibleUsers.length === 0) return { sent: 0 }

  // Batch: fetch expiring items for all eligible users in one query
  const allExpiring = await db
    .select({
      userId: pantryItems.userId,
      name: foods.name,
      expirationDate: pantryItems.expirationDate,
    })
    .from(pantryItems)
    .innerJoin(foods, eq(foods.id, pantryItems.foodId))
    .where(and(
      inArray(pantryItems.userId, eligibleUsers.map(u => u.id)),
      isNull(pantryItems.dateDeleted),
      lte(pantryItems.expirationDate, windowEnd),
      gte(pantryItems.expirationDate, now),
    ))
    .orderBy(pantryItems.userId, pantryItems.expirationDate)

  // Group by userId, capping at 20 items each
  const byUser = new Map<number, typeof allExpiring>()
  for (const row of allExpiring) {
    const list = byUser.get(row.userId) ?? []
    if (list.length < 20) {
      list.push(row)
      byUser.set(row.userId, list)
    }
  }

  let sent = 0
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'

  for (const user of eligibleUsers) {
    const expiring = byUser.get(user.id)
    if (!expiring || expiring.length === 0) continue

    const items = expiring.map(item => {
      const expDate = item.expirationDate!
      const msUntil = expDate.getTime() - now.getTime()
      const daysUntilExpiry = Math.ceil(msUntil / (24 * 60 * 60 * 1000))
      return {
        name: item.name,
        expirationDate: expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        daysUntilExpiry,
      }
    })

    await sendPantryReminderEmail(user.email, user.username, items, `${baseUrl}/pantry`)
    sent++
  }

  return { sent }
}

export async function processRecipeSuggestions(frequency: 'weekly' | 'monthly'): Promise<{ sent: number }> {
  const eligibleUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      cuisinePreferences: users.cuisinePreferences,
      dietaryRestrictions: users.dietaryRestrictions,
    })
    .from(users)
    .where(and(
      isNull(users.dateDeleted),
      eq(users.recipeSuggestionFrequency, frequency),
    ))

  if (eligibleUsers.length === 0) return { sent: 0 }

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'

  // Fetch candidate recipes once for all users — newest first so the pool cycles as
  // new recipes are published rather than always returning the same arbitrary rows.
  const candidates = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      cuisineType: recipes.cuisineType,
      dietaryTags: recipes.dietaryTags,
      slug: recipes.slug,
    })
    .from(recipes)
    .where(and(
      eq(recipes.isPublic, 1),
      isNotNull(recipes.datePublished),
      isNull(recipes.dateDeleted),
    ))
    .orderBy(desc(recipes.datePublished))
    .limit(100)

  if (candidates.length === 0) return { sent: 0 }

  // Fetch ingredient–food links for all candidates in one query
  const candidateIds = candidates.map(r => r.id)
  const ingredientLinks = await db
    .select({ recipeId: ingredients.recipeId, foodId: ingredients.foodId })
    .from(ingredients)
    .where(and(
      inArray(ingredients.recipeId, candidateIds),
      isNull(ingredients.dateDeleted),
    ))

  const ingredientsByRecipe = new Map<number, number[]>()
  for (const row of ingredientLinks) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? []
    list.push(row.foodId)
    ingredientsByRecipe.set(row.recipeId, list)
  }

  // Batch: fetch pantry foods for all eligible users in one query, soonest-expiring first
  const allPantryFoods = await db
    .select({ userId: pantryItems.userId, foodId: pantryItems.foodId })
    .from(pantryItems)
    .where(and(
      inArray(pantryItems.userId, eligibleUsers.map(u => u.id)),
      isNull(pantryItems.dateDeleted),
    ))
    .orderBy(pantryItems.expirationDate)

  const pantryFoodsByUser = new Map<number, Set<number>>()
  for (const row of allPantryFoods) {
    const set = pantryFoodsByUser.get(row.userId) ?? new Set<number>()
    set.add(row.foodId)
    pantryFoodsByUser.set(row.userId, set)
  }

  let sent = 0

  for (const user of eligibleUsers) {
    const cuisinePrefs = (user.cuisinePreferences ?? []) as string[]
    const dietaryRestrictions = (user.dietaryRestrictions ?? []) as string[]
    const pantryFoodIds = pantryFoodsByUser.get(user.id) ?? new Set<number>()

    const scored = candidates
      .filter(r => {
        // Hard filter: recipe must cover all the user's dietary restrictions
        if (dietaryRestrictions.length === 0) return true
        const tags = (r.dietaryTags ?? []) as string[]
        return dietaryRestrictions.every(d => tags.includes(d))
      })
      .map(r => {
        let score = 0
        // Boost for cuisine match
        if (cuisinePrefs.length > 0 && r.cuisineType && cuisinePrefs.includes(r.cuisineType)) score += 2
        // Boost for each pantry ingredient used (prioritises soon-expiring foods)
        const recipeIngredients = ingredientsByRecipe.get(r.id) ?? []
        for (const foodId of recipeIngredients) {
          if (pantryFoodIds.has(foodId)) score += 1
        }
        return { ...r, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (scored.length === 0) continue

    await sendRecipeSuggestionEmail(
      user.email,
      user.username,
      scored.map(r => ({
        name: r.name,
        description: r.description ?? null,
        cuisineType: r.cuisineType ?? null,
        slug: r.slug ?? '',
      })),
      baseUrl,
    )
    sent++
  }

  return { sent }
}
