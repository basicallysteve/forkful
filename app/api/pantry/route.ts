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

  if (!Number.isInteger(body.foodId) || body.foodId <= 0) {
    return NextResponse.json({ error: 'Invalid foodId' }, { status: 400 })
  }
  if (typeof body.originalSizeAmount !== 'number' || body.originalSizeAmount <= 0) {
    return NextResponse.json({ error: 'originalSizeAmount must be a positive number' }, { status: 400 })
  }
  if (typeof body.currentSizeAmount !== 'number' || body.currentSizeAmount < 0) {
    return NextResponse.json({ error: 'currentSizeAmount must be a non-negative number' }, { status: 400 })
  }
  if (body.expirationDate && isNaN(new Date(body.expirationDate).getTime())) {
    return NextResponse.json({ error: 'Invalid expirationDate' }, { status: 400 })
  }

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
  
  // Validate all elements are integers (fail fast)
  for (const id of body.ids) {
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      return NextResponse.json({ error: 'All IDs must be integers' }, { status: 400 })
    }
  }
  
  const deletedIds = await taskRunner.run(() => deletePantryItems(body.ids, user.userId))
  return NextResponse.json({ deletedIds }, { status: 200 })
}
