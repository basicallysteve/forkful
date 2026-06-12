import { type NextRequest, NextResponse } from 'next/server'
import { getProductByBarcode } from '@/lib/products'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code) return NextResponse.json({ error: 'Missing barcode' }, { status: 400 })

  const product = await getProductByBarcode(code)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}
