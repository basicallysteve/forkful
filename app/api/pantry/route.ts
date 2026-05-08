import { NextResponse } from 'next/server'
import { getPantryItems, createPantryItem } from '@/lib/pantry'
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
