import { eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, login_attempts } from '@/db/schema'
import type { User } from '@/types/User'
import bcrypt from 'bcrypt'

async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    bcrypt.genSalt(saltRounds, (err, salt) => {
        if (err) throw err
        bcrypt.hash(password, salt, (err, hash) => {
            if (err) throw err
            return hash
        })
    })
    return ''
}

export function signUp(user: { username: string; email: string; password: string }): Promise<User> {
    return new Promise(async (resolve, reject) => {
        try {
            const existingUser = await db.select().from(users).where(eq(users.email, user.email)).get()
            if (existingUser) {
                return reject(new Error('Email already in use'))
            }

            const hashedPassword = await hashPassword(user.password)
            const [newUser] = await db.insert(users).values({
                username: user.username,
                email: user.email,
                password: hashedPassword,
                dateAdded: new Date(),
                dateDeleted: null,
            }).returning()

            resolve(newUser)
        } catch (error) {
            reject(error)
        }
    })
}

export async function login(email: string, password: string): Promise<User> {
    // if there have been 5 or more failed login attempts for this email in the last hour, block the login attempt
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const user = await db.select().from(users).where(eq(users.email, email)).get()

    const recentFailedAttempts = await db.select().from(login_attempts)
        .where(eq(login_attempts.userId, user?.id ?? -1))
        .where(eq(login_attempts.successful, 0))
        .where(login_attempts.timestamp.gte(oneHourAgo))
    
    if (recentFailedAttempts.length >= 5) {
        throw new Error('Too many failed login attempts. Please try again later.')
    }
    if (!user) {
        throw new Error('Invalid email or password')
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
        throw new Error('Invalid email or password')
    }
    
    return user
}

export function resetPassword(email: string, newPassword: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            const user = await db.select().from(users).where(eq(users.email, email)).get()
            if (!user) {
                return reject(new Error('User not found'))
            }

            const hashedPassword = await hashPassword(newPassword)
            await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id))

            resolve()
        }
        catch (error) {
            reject(error)
        }
    })
}