import 'server-only'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export const SESSION_DURATION_MS = 60 * 60 * 1000 // 1 hour

function getEncodedKey(): Uint8Array {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET environment variable is not set')
    return new TextEncoder().encode(secret)
}

export async function encrypt(data: object): Promise<string> {
    return new SignJWT(data as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
        .sign(getEncodedKey())
}

export async function decrypt(token: string): Promise<object> {
    try {
        const { payload } = await jwtVerify(token, getEncodedKey())
        return payload
    } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Invalid token')
    }
}

