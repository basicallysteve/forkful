import { NextResponse } from 'next/server'
import { getFoodBySlug, updateFood, deleteFood } from '@/lib/foods'
import type { Food } from '@/types/Food'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const food = await getFoodBySlug(slug)
  if (!food) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(food)
}

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params
  const existing = await getFoodBySlug(slug)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body: Partial<Omit<Food, 'id'>> = await request.json()
  const updated = await updateFood(existing.id, body)
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params
  const existing = await getFoodBySlug(slug)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deleteFood(existing.id)
  return new NextResponse(null, { status: 204 })
}
