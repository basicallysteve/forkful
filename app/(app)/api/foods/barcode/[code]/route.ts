import { type NextRequest, NextResponse } from 'next/server'
import { getFoodByBarcode } from '@/lib/foods'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!code) return NextResponse.json({ error: 'Missing barcode' }, { status: 400 })

  const food = await getFoodByBarcode(code)
  if (!food) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(food)
}
