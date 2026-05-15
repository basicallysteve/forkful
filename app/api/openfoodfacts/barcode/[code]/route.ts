import { type NextRequest, NextResponse } from 'next/server'
import { getOpenFoodFactsProduct } from '@/lib/openFoodFacts'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!code || !/^\d{8,14}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 })
  }

  try {
    const product = await getOpenFoodFactsProduct(code)
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ product })
  } catch (err) {
    console.error('OpenFoodFacts barcode error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
  }
}
