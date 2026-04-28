import { NextResponse} from 'next/server'
import { cookies } from 'next/headers'
import { login, trackLoginAttempt } from '@/lib/users'

export async function POST(request: Request) {
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    try {
            const body: { username?: string; password?: string } = await request.json()

            if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 })
            }
            if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
            }
            const user = await login(body.username.trim(), body.password)

            if (!user) {
                await trackLoginAttempt({ userId: -1, successful: false, ipAddress })
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
            }
            await trackLoginAttempt({ userId: user.id, successful: true, ipAddress })
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
            let cookieStore = await cookies()
            cookieStore.set('session', { userId: user.id }, { httpOnly: true, secure: true, sameSite: 'strict', expires: expiresAt })
            return NextResponse.json(user, { status: 200 })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed'
            return NextResponse.json({ error: message }, { status: 400 })
    }
}