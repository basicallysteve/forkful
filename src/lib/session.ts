import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

const encodedKey = new TextEncoder().encode(process.env.JWT_SECRET );

export async function encrypt(data: object): Promise<string> {
    const jwt = await new SignJWT(data)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(encodedKey)
    return jwt
}

export async function decrypt(token: string): Promise<object> {
    try {
        const { payload } = await jwtVerify(token, encodedKey)
        return payload
    } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Invalid token')
    }
}