import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { scrapeRecipeFromUrl } from '@/lib/recipes'

export async function POST(request: NextRequest) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { url: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    const recipe = await scrapeRecipeFromUrl(url)
    if (!recipe) {
      return NextResponse.json({ error: 'Failed to scrape recipe' }, { status: 422 })
    }
    return NextResponse.json(recipe, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to scrape recipe' }, { status: 500 })
  }
}