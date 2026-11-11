import { NextResponse } from 'next/server'
import { createFoodLogEntry, getDailyLog } from '@/lib/foodLog'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { isPositiveInteger } from '@/utils/number'

type CreateBody = {
  foodId?: number
  amount?: number
  unit?: string
  logDate?: string
}

// A plain user-local calendar day: YYYY-MM-DD that is also a real date (rejects 2026-13-40).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function isValidLogDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = new URL(request.url).searchParams.get('date')
  if (!isValidLogDate(date)) {
    return NextResponse.json({ error: 'A valid date (YYYY-MM-DD) is required' }, { status: 400 })
  }

  const dailyLog = await getDailyLog(user.userId, date)
  return NextResponse.json(dailyLog)
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: CreateBody = await request.json()

  if (!isPositiveInteger(body.foodId)) {
    return NextResponse.json({ error: 'foodId must be a positive integer' }, { status: 400 })
  }
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (typeof body.unit !== 'string' || body.unit.trim() === '') {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 })
  }
  if (!isValidLogDate(body.logDate)) {
    return NextResponse.json({ error: 'A valid logDate (YYYY-MM-DD) is required' }, { status: 400 })
  }

  try {
    const entry = await taskRunner.run(() => createFoodLogEntry({
      userId: user.userId,
      foodId: body.foodId!,
      amount: body.amount!,
      unit: body.unit!.trim(),
      logDate: body.logDate!,
    }))
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Food not found') {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'Invalid unit') {
      return NextResponse.json({ error: 'unit is not one of the food\'s measurements' }, { status: 400 })
    }
    // A user_id FK violation (Postgres 23503) means the session points at a user row that no longer
    // exists — a stale JWT after the account/DB was reseeded. Surface it as an auth problem with a
    // clear action, not a 500 that leaks the SQL.
    const cause = (err as { cause?: { code?: string; constraint_name?: string } }).cause
    if (cause?.code === '23503' && cause.constraint_name?.includes('user_id')) {
      return NextResponse.json(
        { error: 'Your session is out of date. Please sign out and sign back in.' },
        { status: 401 }
      )
    }
    // Never leak the raw query/driver message to the client; log server-side and return a clean 500.
    console.error('Failed to create food log entry', err)
    return NextResponse.json({ error: 'Could not save the log entry. Please try again.' }, { status: 500 })
  }
}
