import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { deleteShoppingListItem, updateShoppingListItemStatus } from '@/lib/shoppingList'
import type { ShoppingListItemStatus } from '@/types/ShoppingList'

type Params = { params: Promise<{ id: string }> }

const ITEM_STATUSES: readonly ShoppingListItemStatus[] = ['to_buy', 'bought', 'unavailable']

function isItemStatus(value: unknown): value is ShoppingListItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value)
}

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

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isItemStatus(body.status)) {
    return NextResponse.json({ error: 'status must be one of to_buy, bought, unavailable' }, { status: 400 })
  }

  const updated = await taskRunner.run(() => updateShoppingListItemStatus(id, user.userId, body.status as ShoppingListItemStatus))
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
