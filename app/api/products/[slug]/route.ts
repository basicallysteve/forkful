import { type NextRequest, NextResponse } from 'next/server'
import { getProductBySlug, updateProduct, deleteProduct } from '@/lib/products'
import { taskRunner } from '@/lib/TaskRunner'
import { toSlug } from '@/utils/slug'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const existing = await getProductBySlug(slug)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json()
  const updated = await taskRunner.run(() => updateProduct(existing.id, body))
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const existing = await getProductBySlug(slug)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await taskRunner.run(() => deleteProduct(existing.id))
  return new NextResponse(null, { status: 204 })
}

// Silence unused import warning
void toSlug
