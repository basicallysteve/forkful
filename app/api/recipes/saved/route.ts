import { NextResponse } from 'next/server'
import { getSavedRecipes } from '@/lib/recipes'
import { getSessionUser } from '@/lib/session'

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recipes = await getSavedRecipes(Number(session.userId))
  return NextResponse.json(recipes)
}
