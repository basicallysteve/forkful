import { NextResponse } from 'next/server'
import { getRecipeBySlug, saveRecipe, unsaveRecipe, isSaved } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ slug: string }> }

export async function POST(_request: Request, { params }: Params) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!recipe.isPublic) return NextResponse.json({ error: 'Cannot save a private recipe' }, { status: 403 })

  await taskRunner.run(() => saveRecipe(session.userId, recipe.id))
  return NextResponse.json({ saved: true }, { status: 201 })
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await taskRunner.run(() => unsaveRecipe(session.userId, recipe.id))
  return new NextResponse(null, { status: 204 })
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const saved = await isSaved(session.userId, recipe.id)
  return NextResponse.json({ saved })
}
