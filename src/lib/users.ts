import { eq, and, or, gte } from 'drizzle-orm'
import { db } from '@/db'
import { users, login_attempts } from '@/db/schema'
import type { User } from '@/types/User'
import bcrypt from 'bcrypt'

export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
}

export async function signUp(user: { username: string; email: string; password: string, cuisinePreferences: string[], dietaryRestrictions: string[]}): Promise<User> {
    let newUser: User | null = null;
        const [existingUser] = await db.select().from(users).where(or(eq(users.email, user.email), eq(users.username, user.username)))
        if (existingUser) {
            if(existingUser.email === user.email) {
                throw new Error('Email already in use')
            }
            if(existingUser.username === user.username) {
                throw new Error('Username already in use')
            }
        }

       

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
        
        newUser = {
            id: String(data.id),
            username: data.username,
            email: data.email,
            cuisinePreferences: data.cuisinePreferences,
            dietaryRestrictions: data.dietaryRestrictions,
            password: hashedPassword,
            dateAdded: data.dateAdded!,
            dateDeleted: data.dateDeleted,
        }
        return newUser
    
}

export async function login(username: string, password: string): Promise<User> {
    // if there have been 5 or more failed login attempts for this email in the last hour, block the login attempt
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [user] = await db.select().from(users).where(eq(users.username, username))

    const recentFailedAttempts = await db.select().from(login_attempts)
        .where(and(
            eq(login_attempts.userId, user?.id ?? -1),
            eq(login_attempts.successful, 0),
            gte(login_attempts.dateAdded, oneHourAgo)
        ))
    
    if (recentFailedAttempts.length >= 5) {
        throw new Error('Too many failed login attempts. Please try again later.')
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

export async function trackLoginAttempt({ userId, successful, ipAddress }: { userId: number; successful: boolean; ipAddress: string }) {
    await db.insert(login_attempts).values({
        userId,
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