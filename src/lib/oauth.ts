import 'server-only'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { users, oauthAccounts } from '@/db/schema'

/**
 * Derives a username candidate from an email address.
 * e.g. "jane.doe+tag@gmail.com" → "janedoe"
 */
export function deriveUsername(email: string): string {
  return email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 30) || 'user'
}

/**
 * Returns a username that is unique in the DB, appending a numeric suffix if needed.
 */
export async function uniqueUsername(base: string): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, base))
  if (!existing) return base

  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}${i}`
    const [conflict] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate))
    if (!conflict) return candidate
  }
  throw new Error('Could not generate a unique username')
}

export type OAuthProfile = {
  provider: string
  providerAccountId: string
  email: string
  name: string | null
  avatarUrl: string | null
}

/**
 * Finds or creates a User for an OAuth sign-in.
 * - If an oauth_account already exists for this provider+id, returns that user.
 * - If a user exists with the same email, links the oauth_account to them.
 * - Otherwise, creates a new user and oauth_account.
 *
 * Returns the userId.
 */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<number> {
  // 1. Existing oauth link
  const [existingLink] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(
      eq(oauthAccounts.provider, profile.provider),
      eq(oauthAccounts.providerAccountId, profile.providerAccountId),
    ))

  if (existingLink) return existingLink.userId

  // 2. Email-match → auto-link
  // onConflictDoNothing handles the rare case where two concurrent sign-ins with the same
  // email both pass the existingLink check and race to insert the oauth_account row.
  const [existingUser] = await db
    .select({ id: users.id, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.email, profile.email))

  if (existingUser) {
    if (!existingUser.avatarUrl && profile.avatarUrl) {
      await db.update(users).set({ avatarUrl: profile.avatarUrl }).where(eq(users.id, existingUser.id))
    }
    await db.insert(oauthAccounts).values({
      userId: existingUser.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    }).onConflictDoNothing()
    return existingUser.id
  }

  // 3. New user — wrap in a transaction so user + oauth_account are always created together.
  // If two concurrent sign-ins race here, the users.email unique constraint on the second
  // insert will throw; the signIn callback catches and logs it.
  return await db.transaction(async (tx) => {
    const base = deriveUsername(profile.email)
    const username = await uniqueUsername(base)

    const [newUser] = await tx.insert(users).values({
      username,
      email: profile.email,
      password: null,
      avatarUrl: profile.avatarUrl,
      cuisinePreferences: [],
      dietaryRestrictions: [],
      dateAdded: new Date(),
      dateDeleted: null,
    }).returning({ id: users.id })

    await tx.insert(oauthAccounts).values({
      userId: newUser.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    })

    return newUser.id
  })
}
