import { NextResponse } from 'next/server'
import { getRecipeBySlug, updateRecipe, deleteRecipe } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import type { Recipe } from '@/types/Recipe'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const session = await getSessionUser()
  const recipe = await getRecipeBySlug(slug, session?.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(recipe)
}

export async function PUT(request: Request, { params }: Params) {
  const { slug } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await getRecipeBySlug(slug, session.userId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.userId !== null && existing.userId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: Partial<Omit<Recipe, 'id'>> = await request.json()
  const updated = await taskRunner.run(() => updateRecipe(existing.id, body))
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params
  const existing = await getRecipeBySlug(slug)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await taskRunner.run(() => deleteRecipe(existing.id))
  return new NextResponse(null, { status: 204 })
}
