import { type NextRequest, NextResponse } from 'next/server'
import { searchOpenFoodFacts } from '@/lib/openFoodFacts'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ products: [] })
  }

  try {
    const products = await searchOpenFoodFacts(q.trim())
    return NextResponse.json({ products })
  } catch (err) {
    console.error('OpenFoodFacts search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 502 })
  }
}
