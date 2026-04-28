import { NextResponse } from 'next/server'
import { signUp } from '@/lib/users'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const body: { username?: string; email?: string; password?: string; cuisinePreferences?: string[]; dietaryRestrictions?: string[] } = await request.json()

    if (!body.username || typeof body.username !== 'string' || body.username.trim().length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
    }
    if (!body.email || typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }
    if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await signUp({
      username: body.username.trim(),
      email: body.email,
      password: body.password,
      cuisinePreferences: body.cuisinePreferences ?? [],
      dietaryRestrictions: body.dietaryRestrictions ?? [],
    })
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
