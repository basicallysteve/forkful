import { NextResponse } from 'next/server'
import { getPantryItems, createPantryItem, deletePantryItems } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type CreateBody = {
  foodId: number
  expirationDate?: string | null
  originalSizeAmount: number
  originalSizeUnit?: string
  currentSizeAmount: number
  currentSizeUnit?: string
}

type DeleteBody = {
  ids: number[]
}

const MAX_BULK_DELETE_IDS = 500

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items = await getPantryItems(user.userId)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: CreateBody = await request.json()
  const item = await taskRunner.run(() => createPantryItem({
    ...body,
    userId: user.userId,
    expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
  }))
  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: DeleteBody = await request.json()
  
  // Validate ids array exists and is an array
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'Invalid request: ids array required' }, { status: 400 })
  }
  
  // Cap the number of IDs to prevent arbitrarily large queries
  if (body.ids.length > MAX_BULK_DELETE_IDS) {
    return NextResponse.json({ error: `Cannot delete more than ${MAX_BULK_DELETE_IDS} items at once` }, { status: 400 })
  }
  
  // Validate all elements are integers
  if (!body.ids.every(id => typeof id === 'number' && Number.isInteger(id))) {
    return NextResponse.json({ error: 'All IDs must be integers' }, { status: 400 })
  }
  
  const deletedIds = await taskRunner.run(() => deletePantryItems(body.ids, user.userId))
  return NextResponse.json({ deletedIds }, { status: 200 })
}
