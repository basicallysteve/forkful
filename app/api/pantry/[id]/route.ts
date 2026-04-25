import { NextResponse } from 'next/server'
import { getPantryItemById, updatePantryItem, deletePantryItem } from '@/lib/pantry'
import { taskRunner } from '@/lib/TaskRunner'
import type { UpdatePantryItemData } from '@/lib/pantry'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const item = await getPantryItemById(Number(id))
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const existing = await getPantryItemById(Number(id))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body: UpdatePantryItemData = await request.json()
  const updated = await taskRunner.run(() => updatePantryItem(Number(id), body))
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const existing = await getPantryItemById(Number(id))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await taskRunner.run(() => deletePantryItem(Number(id)))
  return new NextResponse(null, { status: 204 })
}
