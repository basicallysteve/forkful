import { NextResponse } from 'next/server'
import { signUp } from '@/lib/users'

export async function POST(request: Request) {
  try {
    const body: { username: string; email: string; password: string } = await request.json()
    const user = await signUp(body)
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
