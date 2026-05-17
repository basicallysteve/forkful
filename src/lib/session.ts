import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = process.env.JWT_SECRET
if (!secret) throw new Error('JWT_SECRET environment variable is not set')
const encodedKey = new TextEncoder().encode(secret)

export const SESSION_DURATION_MS = 60 * 60 * 1000 // 1 hour

export async function encrypt(data: object): Promise<string> {
    return new SignJWT(data as Parameters<typeof SignJWT>[0])
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
        .sign(encodedKey)
}

export async function decrypt(token: string): Promise<object> {
    try {
        const { payload } = await jwtVerify(token, encodedKey)
        return payload
    } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Invalid token')
    }
}

export async function getSessionUser(): Promise<{ userId: string; username: string } | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return null
    try {
        const payload = await decrypt(token) as { userId?: string; username?: string }
        if (!payload.userId || !payload.username) return null
        return { userId: payload.userId, username: payload.username }
    } catch {
        return null
    }
}
