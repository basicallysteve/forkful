import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { deleteShoppingListItem } from '@/lib/shoppingList'

type Params = { params: Promise<{ id: string }> }

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const deleted = await taskRunner.run(() => deleteShoppingListItem(id, user.userId))
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
