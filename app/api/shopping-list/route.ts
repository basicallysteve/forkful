import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import {
  createShoppingListFoodItem,
  createShoppingListFreeformItem,
  createShoppingListProductItem,
  getOrCreateActiveShoppingList,
  getShoppingListItems,
} from '@/lib/shoppingList'
import type { ShoppingListItem, ShoppingListItemSourceType } from '@/types/ShoppingList'

type CreateBody = {
  sourceType?: ShoppingListItemSourceType
  foodId?: number
  productId?: number
  name?: string
  amount?: number
  unit?: string | null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

// Data-layer error messages the route surfaces as client errors; anything else is a real 500.
const NOT_FOUND_ERRORS = ['Food not found', 'Product not found']
const VALIDATION_ERRORS = [
  'Unit is not valid for this food',
  'Unit is not valid for this product',
  'Amount must be greater than zero',
  'Amount is too large',
  'Name is required',
  'Name is too long',
  'Unit is too long',
]

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await taskRunner.run(() => getOrCreateActiveShoppingList(user.userId))
  const items = await getShoppingListItems(user.userId)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Default to 'food' so the original food-only client payload (no sourceType) still works.
  const sourceType: ShoppingListItemSourceType = body.sourceType ?? 'food'

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  try {
    let item: ShoppingListItem

    if (sourceType === 'food') {
      if (!isPositiveInteger(body.foodId)) {
        return NextResponse.json({ error: 'foodId must be a positive integer' }, { status: 400 })
      }
      if (typeof body.unit !== 'string' || body.unit.trim().length === 0) {
        return NextResponse.json({ error: 'unit is required' }, { status: 400 })
      }
      item = await taskRunner.run(() => createShoppingListFoodItem({
        userId: user.userId,
        foodId: body.foodId as number,
        amount: body.amount as number,
        unit: (body.unit as string).trim(),
      }))
    } else if (sourceType === 'product') {
      if (!isPositiveInteger(body.productId)) {
        return NextResponse.json({ error: 'productId must be a positive integer' }, { status: 400 })
      }
      if (typeof body.unit !== 'string' || body.unit.trim().length === 0) {
        return NextResponse.json({ error: 'unit is required' }, { status: 400 })
      }
      item = await taskRunner.run(() => createShoppingListProductItem({
        userId: user.userId,
        productId: body.productId as number,
        amount: body.amount as number,
        unit: (body.unit as string).trim(),
      }))
    } else if (sourceType === 'freeform') {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 })
      }
      const unit = typeof body.unit === 'string' && body.unit.trim().length > 0 ? body.unit.trim() : null
      item = await taskRunner.run(() => createShoppingListFreeformItem({
        userId: user.userId,
        name: body.name as string,
        amount: body.amount as number,
        unit,
      }))
    } else {
      return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (NOT_FOUND_ERRORS.includes(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (VALIDATION_ERRORS.includes(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    throw error
  }
}
