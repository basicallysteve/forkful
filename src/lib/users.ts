import { eq, and, gt, gte, isNull, isNotNull, lt, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { users, login_attempts, passwordResetTokens, oauthAccounts, accountFeedback, recipes } from '@/db/schema'
import type { User, RecipeSuggestionFrequency, PantryExpirationFrequency } from '@/types/User'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { sendGoodbyeEmail, sendDeactivationExpiryWarningEmail } from '@/lib/email'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
    hasPassword: !!row.password,
    cuisinePreferences: row.cuisinePreferences,
    dietaryRestrictions: row.dietaryRestrictions,
    avatarUrl: row.avatarUrl ?? null,
    marketingEmailOptIn: row.marketingEmailOptIn,
    recipeSuggestionFrequency: row.recipeSuggestionFrequency as RecipeSuggestionFrequency,
    pantryExpirationFrequency: row.pantryExpirationFrequency as PantryExpirationFrequency,
    dateAdded: row.dateAdded!,
    dateDeleted: row.dateDeleted,
  }
}

export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
}

export async function signUp(user: { username: string; email: string; password: string; cuisinePreferences: string[]; dietaryRestrictions: string[]; marketingEmailOptIn?: boolean }): Promise<User> {
    if (!USERNAME_REGEX.test(user.username)) throw new Error('Invalid username format')

    const [existingByUsername] = await db.select().from(users).where(eq(users.username, user.username))
    if (existingByUsername) throw new Error('Username already in use')

    const [existingByEmail] = await db.select().from(users).where(eq(users.email, user.email))
    if (existingByEmail) throw new Error('Email already in use')

    const hashedPassword = await hashPassword(user.password)
    const now = new Date()
    const [data] = await db.insert(users).values({
        username: user.username,
        email: user.email,
        password: hashedPassword,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
        marketingEmailOptIn: user.marketingEmailOptIn ?? false,
        passwordChangedAt: now,
        dateAdded: now,
        dateDeleted: null,
    }).returning();

    return mapUser(data)
}

export async function login(username: string, password: string, ipAddress: string): Promise<User> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // IP-based rate limit — catches attempts against non-existent usernames too
    const recentFailedByIp = await db.select().from(login_attempts)
        .where(and(
            eq(login_attempts.ipAddress, ipAddress),
            eq(login_attempts.successful, 0),
            gte(login_attempts.dateAdded, oneHourAgo)
        ))

    if (recentFailedByIp.length >= 5) {
        throw new Error('Too many failed login attempts. Please try again later.')
    }

    const [user] = await db.select().from(users).where(eq(users.username, username))

    // Per-user rate limit — independent of IP so VPN rotation doesn't bypass it
    if (user) {
        const recentFailedByUser = await db.select().from(login_attempts)
            .where(and(
                eq(login_attempts.userId, user.id),
                eq(login_attempts.successful, 0),
                gte(login_attempts.dateAdded, oneHourAgo)
            ))

        if (recentFailedByUser.length >= 5) {
            throw new Error('Too many failed login attempts. Please try again later.')
        }
    }

    if (!user || !user.password) {
        await trackLoginAttempt({ ipAddress, successful: false })
        throw new Error('Invalid username or password')
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
        await trackLoginAttempt({ userId: user.id, ipAddress, successful: false })
        throw new Error('Invalid username or password')
    }

    if (user.dateDeleted) {
        throw new Error('ACCOUNT_DEACTIVATED')
    }

    return mapUser(user)
}

export async function trackLoginAttempt({ userId, successful, ipAddress }: { userId?: number; successful: boolean; ipAddress: string }) {
    await db.insert(login_attempts).values({
        userId: userId ?? null,
        successful: successful ? 1 : 0,
        ipAddress,
        dateAdded: new Date(),
    })
}

// Successful logins always include a userId, so successful=1 + userId=null is
// uniquely available to tag password-reset requests without touching the schema.
export async function checkPasswordResetRateLimit(ipAddress: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const rows = await db.select({ id: login_attempts.id })
        .from(login_attempts)
        .where(and(
            eq(login_attempts.ipAddress, ipAddress),
            eq(login_attempts.successful, 1),
            isNull(login_attempts.userId),
            gte(login_attempts.dateAdded, oneHourAgo),
        ))
    if (rows.length >= 3) {
        throw new Error('Too many password reset requests. Please try again later.')
    }
}

function hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export async function createPasswordResetToken(email: string): Promise<{ token: string; userId: number } | null> {
    const [user] = await db.select({ id: users.id, password: users.password })
        .from(users)
        .where(and(eq(users.email, email), isNull(users.dateDeleted)))

    if (!user || !user.password) return null

    const now = new Date()

    // Delete previous tokens for this user — expired, used, or superseded by this request
    await db.delete(passwordResetTokens)
        .where(and(
            eq(passwordResetTokens.userId, user.id),
            or(isNotNull(passwordResetTokens.usedAt), lt(passwordResetTokens.expiresAt, now)),
        ))

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000)

    await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
    })

    return { token: rawToken, userId: user.id }
}

export async function redeemPasswordResetToken(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken)
    const now = new Date()
    const hashedPassword = await hashPassword(newPassword)

    await db.transaction(async (tx) => {
        // Atomically claim the token — only one concurrent request can win this update
        const [claimed] = await tx.update(passwordResetTokens)
            .set({ usedAt: now })
            .where(and(
                eq(passwordResetTokens.tokenHash, tokenHash),
                isNull(passwordResetTokens.usedAt),
                gte(passwordResetTokens.expiresAt, now),
            ))
            .returning({ userId: passwordResetTokens.userId })

        if (!claimed) throw new Error('Invalid or expired reset link')

        // Guard against resetting to the same password
        const [user] = await tx.select({ password: users.password })
            .from(users)
            .where(eq(users.id, claimed.userId))
        if (user?.password && await bcrypt.compare(newPassword, user.password)) {
            throw new Error('New password must be different from your current password')
        }

        await tx.update(users)
            .set({ password: hashedPassword, passwordChangedAt: now })
            .where(eq(users.id, claimed.userId))
    })
}

export async function getOAuthProvidersForEmail(email: string): Promise<string[]> {
    const [user] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), isNull(users.dateDeleted)))

    if (!user) return []

    const accounts = await db.select({ provider: oauthAccounts.provider })
        .from(oauthAccounts)
        .where(eq(oauthAccounts.userId, user.id))

    return accounts.map(a => a.provider)
}

export async function getUser(userId: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) return null
    return mapUser(user)
}

export async function updateUserAvatar(userId: number, avatarUrl: string, oldAvatarUrl: string | null): Promise<void> {
    await db.update(users).set({ avatarUrl }).where(eq(users.id, userId))
    if (oldAvatarUrl) {
        const { del } = await import('@vercel/blob')
        await del(oldAvatarUrl).catch(() => null)
    }
}

export async function deleteUserAvatar(userId: number, oldAvatarUrl: string | null): Promise<void> {
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, userId))
    if (oldAvatarUrl) {
        const { del } = await import('@vercel/blob')
        await del(oldAvatarUrl).catch(() => null)
    }
}

export async function completeOnboarding(userId: number, data: { cuisinePreferences: string[]; dietaryRestrictions: string[]; marketingEmailOptIn?: boolean }): Promise<void> {
    await db.update(users).set({
        cuisinePreferences: data.cuisinePreferences,
        dietaryRestrictions: data.dietaryRestrictions,
        marketingEmailOptIn: data.marketingEmailOptIn ?? false,
        onboardingCompletedAt: new Date(),
    }).where(eq(users.id, userId))
}

export async function updateUserPreferences(userId: number, data: { cuisinePreferences: string[]; dietaryRestrictions: string[] }): Promise<void> {
    await db.update(users).set({
        cuisinePreferences: data.cuisinePreferences,
        dietaryRestrictions: data.dietaryRestrictions,
    }).where(eq(users.id, userId))
}

export async function updateUserEmail(userId: number, newEmail: string): Promise<void> {
    const [existing] = await db.select().from(users).where(eq(users.email, newEmail))
    if (existing && existing.id !== userId) throw new Error('Email already in use')
    await db.update(users).set({ email: newEmail }).where(eq(users.id, userId))
}

export async function updateUserPassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user || !user.password) throw new Error('User not found')
    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) throw new Error('Current password is incorrect')
    const hashed = await hashPassword(newPassword)
    await db.update(users).set({ password: hashed, passwordChangedAt: new Date() }).where(eq(users.id, userId))
}

export async function forceResetPassword(userId: number, newPassword: string): Promise<void> {
    const [user] = await db.select({ password: users.password }).from(users).where(eq(users.id, userId))
    if (!user) throw new Error('User not found')

    // Guard against resetting to the same password
    if (user.password && await bcrypt.compare(newPassword, user.password)) {
        throw new Error('New password must be different from your current password')
    }

    const hashed = await hashPassword(newPassword)
    await db.update(users)
        .set({ password: hashed, passwordChangedAt: new Date() })
        .where(eq(users.id, userId))
}

export async function updateUsername(userId: number, newUsername: string): Promise<void> {
    if (!USERNAME_REGEX.test(newUsername)) throw new Error('Invalid username format')
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, newUsername))
    if (existing && existing.id !== userId) throw new Error('Username already in use')
    await db.update(users).set({ username: newUsername }).where(eq(users.id, userId))
}

export async function updateEmailPreferences(userId: number, data: {
    marketingEmailOptIn: boolean
    recipeSuggestionFrequency: RecipeSuggestionFrequency
    pantryExpirationFrequency: PantryExpirationFrequency
}): Promise<void> {
    await db.update(users).set(data).where(eq(users.id, userId))
}

export async function deactivateAccount(userId: number): Promise<void> {
    const [user] = await db.select({ email: users.email, username: users.username })
        .from(users).where(eq(users.id, userId))
    await db.update(users).set({ dateDeleted: new Date() }).where(eq(users.id, userId))
    if (user) {
        sendGoodbyeEmail(user.email, user.username, 'deactivated').catch(() => null)
    }
}

export async function reactivateAccount(userId: number): Promise<void> {
    await db.update(users)
        .set({ dateDeleted: null, deactivationWarningEmailSentAt: null })
        .where(eq(users.id, userId))
}

export async function deleteAccount(userId: number): Promise<void> {
    const [user] = await db.select({ email: users.email, username: users.username })
        .from(users).where(eq(users.id, userId))

    await db.transaction(async (tx) => {
        // Hard-delete private recipes and unpublished public recipes.
        // Published public recipes are anonymised via the FK onDelete:'set null' cascade when the user row is deleted.
        await tx.delete(recipes)
            .where(and(
                eq(recipes.userId, userId),
                or(
                    eq(recipes.isPublic, 0),
                    isNull(recipes.datePublished),
                ),
            ))

        // Hard-delete the user row — cascades to pantry_items, oauth_accounts,
        // password_reset_tokens, login_attempts. Published public recipes get userId set null via FK.
        await tx.delete(users).where(eq(users.id, userId))
    })

    if (user) {
        sendGoodbyeEmail(user.email, user.username, 'deleted').catch(() => null)
    }
}

export async function createAccountFeedback(data: {
    userId: number
    action: 'deactivated' | 'deleted'
    reasons: string[]
    comment?: string
}): Promise<void> {
    await db.insert(accountFeedback).values({
        userId: data.userId,
        action: data.action,
        reasons: data.reasons,
        comment: data.comment ?? null,
    })
}

export async function processDeactivatedAccounts(): Promise<{ warned: number; deleted: number }> {
    const now = new Date()
    const elevenMonthsAgo = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Auto-delete accounts deactivated for 12+ months
    const toDelete = await db.select({ id: users.id, email: users.email, username: users.username })
        .from(users)
        .where(and(isNotNull(users.dateDeleted), lte(users.dateDeleted, twelveMonthsAgo)))

    let deleted = 0
    for (const user of toDelete) {
        try {
            await deleteAccount(user.id)
            deleted++
        } catch (err) {
            console.error('[processDeactivatedAccounts] failed to delete user', user.id, err)
        }
    }

    // Send 11-month warning to accounts deactivated 335–364 days ago that haven't been warned yet.
    // Uses gt (not lt) so the window is between elevenMonthsAgo and twelveMonthsAgo, not beyond it.
    const toWarn = await db.select({ id: users.id, email: users.email, username: users.username, dateDeleted: users.dateDeleted })
        .from(users)
        .where(and(
            isNotNull(users.dateDeleted),
            lte(users.dateDeleted, elevenMonthsAgo),
            gt(users.dateDeleted, twelveMonthsAgo),
            isNull(users.deactivationWarningEmailSentAt),
        ))

    let warned = 0
    for (const user of toWarn) {
        try {
            // Claim the warning slot atomically before sending — prevents double-send if
            // two cron instances overlap and both selected this user before either updated.
            const [claimed] = await db.update(users)
                .set({ deactivationWarningEmailSentAt: now })
                .where(and(eq(users.id, user.id), isNull(users.deactivationWarningEmailSentAt)))
                .returning({ id: users.id })

            if (!claimed) continue

            const deletionDate = new Date(user.dateDeleted!.getTime() + 365 * 24 * 60 * 60 * 1000)
            await sendDeactivationExpiryWarningEmail(user.email, user.username, deletionDate)
            warned++
        } catch (err) {
            console.error('[processDeactivatedAccounts] failed to warn user', user.id, err)
        }
    }

    return { warned, deleted }
}
