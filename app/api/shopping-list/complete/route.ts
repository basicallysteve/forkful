import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { completeShoppingTrip } from '@/lib/shoppingList'

// Shopping Trip Completion (see CONTEXT.md): archive the active list, transfer bought Food/Product
// lines to the Pantry, and either keep or drop the still-unbought lines as one batch. `keepUnbought`
// is the answer to the single leftover prompt; the client sends `false` outright when nothing is left.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = raw as { keepUnbought?: unknown }

  if (typeof body.keepUnbought !== 'boolean') {
    return NextResponse.json({ error: 'keepUnbought must be a boolean' }, { status: 400 })
  }

  const result = await taskRunner.run(() => completeShoppingTrip(user.userId, { keepUnbought: body.keepUnbought as boolean }))
  if (!result) return NextResponse.json({ error: 'No active shopping list' }, { status: 404 })

  return NextResponse.json(result)
}
