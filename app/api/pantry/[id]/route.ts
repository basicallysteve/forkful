import { NextResponse } from 'next/server'
import { getPantryItemById, updatePantryItem, deletePantryItem } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import type { UpdatePantryItemData } from '@/lib/pantry'

type Params = { params: Promise<{ id: string }> }

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

type UpdateBody = {
  expirationDate?: string | null
  originalSizeAmount?: number
  originalSizeUnit?: string
  currentSizeAmount?: number
  currentSizeUnit?: string
  frozenDate?: string | null
}

function parseUpdateBody(body: UpdateBody): UpdatePantryItemData {
  const data: UpdatePantryItemData = {}
  if (body.expirationDate !== undefined) data.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null
  if (body.frozenDate !== undefined) data.frozenDate = body.frozenDate ? new Date(body.frozenDate) : null
  if (body.originalSizeAmount !== undefined) data.originalSizeAmount = body.originalSizeAmount
  if (body.originalSizeUnit !== undefined) data.originalSizeUnit = body.originalSizeUnit
  if (body.currentSizeAmount !== undefined) data.currentSizeAmount = body.currentSizeAmount
  if (body.currentSizeUnit !== undefined) data.currentSizeUnit = body.currentSizeUnit
  return data
}

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const item = await getPantryItemById(id, user.userId)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const body: UpdateBody = await request.json()
  const updated = await taskRunner.run(() => updatePantryItem({ id, userId: user.userId, data: parseUpdateBody(body) }))
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const deleted = await taskRunner.run(() => deletePantryItem(id, user.userId))
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
