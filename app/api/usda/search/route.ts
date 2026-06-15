import { type NextRequest, NextResponse } from 'next/server'
import { searchUSDAFoods, searchUSDABranded } from '@/lib/usda'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const type = request.nextUrl.searchParams.get('type') ?? 'foods'

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ foods: [], products: [] })
  }

  try {
    const [foodResults, brandedResults] = await Promise.all([
      type === 'foods' || type === 'all' ? searchUSDAFoods(q.trim()) : Promise.resolve([]),
      type === 'branded' || type === 'all' ? searchUSDABranded(q.trim()) : Promise.resolve([]),
    ])
    return NextResponse.json({ foods: foodResults, products: brandedResults })
  } catch (err) {
    console.error('USDA search error:', err)
    return NextResponse.json({ error: 'USDA search failed' }, { status: 502 })
  }
}
