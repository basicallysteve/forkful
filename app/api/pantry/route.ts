import { NextResponse } from 'next/server'
import { getPantryItems, createPantryItem } from '@/lib/pantry'
import { taskRunner } from '@/lib/TaskRunner'
import type { CreatePantryItemData } from '@/lib/pantry'

export async function GET() {
  const items = await getPantryItems()
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const body: CreatePantryItemData = await request.json()
  const item = await taskRunner.run(() => createPantryItem(body))
  return NextResponse.json(item, { status: 201 })
}
