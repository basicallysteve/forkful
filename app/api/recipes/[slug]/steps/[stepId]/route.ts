import { NextResponse } from 'next/server'
import { getRecipeBySlug, updateRecipeStep, deleteRecipeStep } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ slug: string; stepId: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { slug, stepId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recipe = await getRecipeBySlug(slug, session.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (recipe.userId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: { title?: string | null; content?: string } = await request.json()
  const step = await taskRunner.run(() => updateRecipeStep(Number(stepId), recipe.id, body))
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })
  return NextResponse.json(step)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug, stepId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recipe = await getRecipeBySlug(slug, session.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (recipe.userId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await taskRunner.run(() => deleteRecipeStep(Number(stepId), recipe.id))
  return new NextResponse(null, { status: 204 })
}

