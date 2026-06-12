import { eq, and, isNull, lte, gte, inArray, isNotNull } from 'drizzle-orm'
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

  let sent = 0
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'

  for (const user of eligibleUsers) {
    const expiring = await db
      .select({
        name: foods.name,
        expirationDate: pantryItems.expirationDate,
      })
      .from(pantryItems)
      .innerJoin(foods, eq(foods.id, pantryItems.foodId))
      .where(and(
        eq(pantryItems.userId, user.id),
        isNull(pantryItems.dateDeleted),
        lte(pantryItems.expirationDate, windowEnd),
        gte(pantryItems.expirationDate, now),
      ))
      .orderBy(pantryItems.expirationDate)
      .limit(20)

    if (expiring.length === 0) continue

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

  let sent = 0
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'

  for (const user of eligibleUsers) {
    const cuisinePrefs = (user.cuisinePreferences ?? []) as string[]
    const dietaryRestrictions = (user.dietaryRestrictions ?? []) as string[]

    // Fetch user's pantry food IDs, soonest-expiring first — used to boost recipes using those foods
    const pantryFoods = await db
      .select({ foodId: pantryItems.foodId, expirationDate: pantryItems.expirationDate })
      .from(pantryItems)
      .where(and(eq(pantryItems.userId, user.id), isNull(pantryItems.dateDeleted)))
      .orderBy(pantryItems.expirationDate)
      .limit(30)
    const pantryFoodIds = new Set(pantryFoods.map(p => p.foodId))

    // Fetch candidate public published recipes (fetch a wider pool so we can score and filter)
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
      .limit(50)

    // Fetch ingredient food IDs for candidate recipes to identify pantry overlaps
    const candidateIds = candidates.map(r => r.id)
    const ingredientLinks = candidateIds.length > 0
      ? await db
          .select({ recipeId: ingredients.recipeId, foodId: ingredients.foodId })
          .from(ingredients)
          .where(and(
            inArray(ingredients.recipeId, candidateIds),
            isNull(ingredients.dateDeleted),
          ))
      : []
    const ingredientsByRecipe = new Map<number, number[]>()
    for (const row of ingredientLinks) {
      const list = ingredientsByRecipe.get(row.recipeId) ?? []
      list.push(row.foodId)
      ingredientsByRecipe.set(row.recipeId, list)
    }

    // Score and filter candidates
    const scored = candidates
      .filter(r => {
        // Hard filter: dietary restrictions — recipe must cover all the user's restrictions
        if (dietaryRestrictions.length === 0) return true
        const tags = (r.dietaryTags ?? []) as string[]
        return dietaryRestrictions.every(d => tags.includes(d))
      })
      .map(r => {
        let score = 0
        // Boost for cuisine match
        if (cuisinePrefs.length > 0 && r.cuisineType && cuisinePrefs.includes(r.cuisineType)) score += 2
        // Boost for each pantry ingredient used (especially useful for soon-expiring foods)
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
