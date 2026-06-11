import { eq, and, gte, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, login_attempts, passwordResetTokens, oauthAccounts } from '@/db/schema'
import type { User } from '@/types/User'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
}

export async function signUp(user: { username: string; email: string; password: string, cuisinePreferences: string[], dietaryRestrictions: string[]}): Promise<User> {
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
        passwordChangedAt: now,
        dateAdded: now,
        dateDeleted: null,
    }).returning();

    return {
        id: String(data.id),
        username: data.username,
        email: data.email,
        hasPassword: true,
        cuisinePreferences: data.cuisinePreferences,
        dietaryRestrictions: data.dietaryRestrictions,
        password: hashedPassword,
        dateAdded: data.dateAdded!,
        dateDeleted: data.dateDeleted,
    }
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

    return {
        id: String(user.id),
        username: user.username,
        email: user.email,
        hasPassword: !!user.password,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
        avatarUrl: user.avatarUrl ?? null,
        dateAdded: user.dateAdded!,
        dateDeleted: user.dateDeleted,
    }
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

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

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
    if (!user) {
        return null
    }
    return {
        id: String(user.id),
        username: user.username,
        email: user.email,
        hasPassword: !!user.password,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
        avatarUrl: user.avatarUrl ?? null,
        dateAdded: user.dateAdded!,
        dateDeleted: user.dateDeleted,
    }
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

export async function completeOnboarding(userId: number, data: { cuisinePreferences: string[]; dietaryRestrictions: string[] }): Promise<void> {
    await db.update(users).set({
        cuisinePreferences: data.cuisinePreferences,
        dietaryRestrictions: data.dietaryRestrictions,
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
    const hashed = await hashPassword(newPassword)
    await db.update(users)
        .set({ password: hashed, passwordChangedAt: new Date() })
        .where(eq(users.id, userId))
}
