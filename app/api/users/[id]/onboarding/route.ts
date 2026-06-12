import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { completeOnboarding } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (sessionUser.userId !== Number(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every(x => typeof x === 'string')

    await taskRunner.run(() => completeOnboarding(Number(id), {
      cuisinePreferences: isStringArray(body.cuisinePreferences) ? body.cuisinePreferences : [],
      dietaryRestrictions: isStringArray(body.dietaryRestrictions) ? body.dietaryRestrictions : [],
      marketingEmailOptIn: body.marketingEmailOptIn === true,
    }))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
