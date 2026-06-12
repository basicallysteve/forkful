import { eq, and, isNull, lte, gte, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users, pantryItems, foods, recipes } from '@/db/schema'
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
    })
    .from(users)
    .where(and(
      isNull(users.dateDeleted),
      eq(users.recipeSuggestionFrequency, frequency),
    ))

  let sent = 0
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'

  for (const user of eligibleUsers) {
    const prefs = (user.cuisinePreferences ?? []) as string[]

    // Prefer recipes matching cuisine preferences; fall back to any public recipes
    let suggestions = prefs.length > 0
      ? await db
          .select({ name: recipes.name, description: recipes.description, cuisineType: recipes.cuisineType, slug: recipes.slug })
          .from(recipes)
          .where(and(
            eq(recipes.isPublic, 1),
            isNull(recipes.dateDeleted),
            inArray(recipes.cuisineType, prefs),
          ))
          .orderBy(recipes.datePublished)
          .limit(5)
      : []

    if (suggestions.length < 3) {
      const extra = await db
        .select({ name: recipes.name, description: recipes.description, cuisineType: recipes.cuisineType, slug: recipes.slug })
        .from(recipes)
        .where(and(eq(recipes.isPublic, 1), isNull(recipes.dateDeleted)))
        .orderBy(recipes.datePublished)
        .limit(5)
      const existing = new Set(suggestions.map(r => r.slug))
      suggestions = [...suggestions, ...extra.filter(r => !existing.has(r.slug))].slice(0, 5)
    }

    if (suggestions.length === 0) continue

    await sendRecipeSuggestionEmail(
      user.email,
      user.username,
      suggestions.map(r => ({
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
