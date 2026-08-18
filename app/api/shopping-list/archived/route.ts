import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getArchivedShoppingLists } from '@/lib/shoppingList'

// The archived-lists index (price history). Read-only, so it doesn't go through the taskRunner (that
// centralises write retry/audit hooks; a GET has nothing to retry). Scoped to the session user.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lists = await getArchivedShoppingLists(user.userId)
  return NextResponse.json(lists)
}
