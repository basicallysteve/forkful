import { type NextRequest, NextResponse } from 'next/server'
import { getProductByBarcode, createProduct } from '@/lib/products'
import { getOpenFoodFactsProduct, mapOFFProductToProduct } from '@/lib/openFoodFacts'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  if (!code) return NextResponse.json({ error: 'Missing barcode' }, { status: 400 })

  // 1. Local DB
  const local = await getProductByBarcode(code)
  if (local) return NextResponse.json(local)

  // 2. Open Food Facts — create and return if found
  const offProduct = await getOpenFoodFactsProduct(code)
  if (!offProduct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const created = await taskRunner.run(() => createProduct(mapOFFProductToProduct(offProduct)))
  return NextResponse.json(created, { status: 201 })
}
