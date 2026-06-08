import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { login, trackLoginAttempt } from '@/lib/users' // trackLoginAttempt used for successful logins
import { encrypt, SESSION_DURATION_MS } from '@/lib/session'
import { getClientIp } from '@/lib/ip'

const secure = process.env.NODE_ENV === 'production'

export async function POST(request: Request) {
    const ipAddress = getClientIp(request.headers)

    try {
        const body: { username?: string; password?: string } = await request.json()

        if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 })
        }
        if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
        }

        const user = await login(body.username.trim(), body.password, ipAddress)

        await trackLoginAttempt({ userId: Number(user.id), successful: true, ipAddress })

        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
        const cookieStore = await cookies()
        const sessionData = { userId: user.id, username: user.username, avatarUrl: user.avatarUrl ?? null }
        cookieStore.set('session', await encrypt(sessionData), { httpOnly: true, secure, sameSite: 'strict', expires: expiresAt })

        return NextResponse.json({ username: user.username, email: user.email })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed'

        let statusCode = 400
        if (message === 'Invalid username or password') statusCode = 401
        else if (message === 'Too many failed login attempts. Please try again later.') statusCode = 429

        return NextResponse.json({ error: message }, { status: statusCode })
    }
}
