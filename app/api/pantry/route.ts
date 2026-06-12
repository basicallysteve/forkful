import { NextResponse } from 'next/server'
import { getPantryItems, createPantryItem, deletePantryItems } from '@/lib/pantry'
import type { PantryQueryOptions } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type CreateBody = {
  sourceType?: 'food' | 'product'
  foodId?: number
  productId?: number
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

const VALID_STATUSES = new Set(['all', 'expired', 'expiring-soon', 'good'])
const VALID_SORT_BY = new Set(['name', 'expirationDate', 'addedDate', 'status'])
const VALID_SORT_DIR = new Set(['asc', 'desc'])

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const options: PantryQueryOptions = {}

  const search = searchParams.get('search')
  if (search) options.search = search

  const status = searchParams.get('status')
  if (status && VALID_STATUSES.has(status)) options.status = status as PantryQueryOptions['status']

  const sortBy = searchParams.get('sortBy')
  if (sortBy && VALID_SORT_BY.has(sortBy)) options.sortBy = sortBy as PantryQueryOptions['sortBy']

  const sortDir = searchParams.get('sortDir')
  if (sortDir && VALID_SORT_DIR.has(sortDir)) options.sortDir = sortDir as PantryQueryOptions['sortDir']

  const items = await getPantryItems(user.userId, options)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: CreateBody = await request.json()

  const sourceType = body.sourceType ?? (body.foodId ? 'food' : 'product')
  const hasFoodId = Number.isInteger(body.foodId) && (body.foodId ?? 0) > 0
  const hasProductId = Number.isInteger(body.productId) && (body.productId ?? 0) > 0
  if (sourceType === 'food' && !hasFoodId) {
    return NextResponse.json({ error: 'Invalid foodId' }, { status: 400 })
  }
  if (sourceType === 'product' && !hasProductId) {
    return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
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
