import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getArchivedShoppingListById } from '@/lib/shoppingList'

type Params = { params: Promise<{ id: string }> }

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

// One archived list's bought lines and prices. Read-only (no taskRunner). The data function scopes to
// the caller and to `archived` status, so an active list, another user's list, or a missing id all come
// back null → 404.
export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const list = await getArchivedShoppingListById(id, user.userId)
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(list)
}
