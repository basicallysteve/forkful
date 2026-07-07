import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { createShoppingListFoodItem, getOrCreateActiveShoppingList, getShoppingListItems } from '@/lib/shoppingList'

type CreateBody = {
  foodId: number
  amount: number
  unit: string
}

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

  if (!Number.isInteger(body.foodId) || body.foodId <= 0) {
    return NextResponse.json({ error: 'foodId must be a positive integer' }, { status: 400 })
  }

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  if (typeof body.unit !== 'string' || body.unit.trim().length === 0) {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 })
  }

  const unit = body.unit.trim()

  try {
    const item = await taskRunner.run(() => createShoppingListFoodItem({
      userId: user.userId,
      foodId: body.foodId,
      amount: body.amount,
      unit,
    }))

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Food not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'Unit is not valid for this food' || error.message === 'Amount must be greater than zero') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    throw error
  }
}
