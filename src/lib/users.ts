import { eq, and, gte } from 'drizzle-orm'
import { db } from '@/db'
import { users, login_attempts } from '@/db/schema'
import type { User } from '@/types/User'
import bcrypt from 'bcrypt'

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
    const [data] = await db.insert(users).values({
        username: user.username,
        email: user.email,
        password: hashedPassword,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
        dateAdded: new Date(),
        dateDeleted: null,
    }).returning();

    return {
        id: String(data.id),
        username: data.username,
        email: data.email,
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

    if (!user) {
        throw new Error('Invalid username or password')
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
        throw new Error('Invalid username or password')
    }

    return {
        id: String(user.id),
        username: user.username,
        email: user.email,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
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

export async function resetPassword(email: string, newPassword: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.email, email))
    if (!user) {
        throw new Error('User not found')
    }

    const hashedPassword = await hashPassword(newPassword)
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id))
}

export async function getUser(userId: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) {
        return null
    }
    return {
        username: user.username,
        email: user.email,
        cuisinePreferences: user.cuisinePreferences,
        dietaryRestrictions: user.dietaryRestrictions,
        dateAdded: user.dateAdded!,
        dateDeleted: user.dateDeleted,
    }
}
