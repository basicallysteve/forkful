import { NextResponse } from 'next/server'
import { getRecipeBySlug, getRecipeSteps, createRecipeStep, reorderRecipeSteps } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const session = await getSessionUser()
  const recipe = await getRecipeBySlug(slug, session?.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const steps = await getRecipeSteps(recipe.id)
  return NextResponse.json(steps)
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recipe = await getRecipeBySlug(slug, session.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (recipe.userId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: { title?: string; content: string } = await request.json()
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }
  const step = await taskRunner.run(() => createRecipeStep(recipe.id, body))
  return NextResponse.json(step, { status: 201 })
}

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recipe = await getRecipeBySlug(slug, session.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (recipe.userId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: { orderedIds: number[] } = await request.json()
  if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((id) => Number.isInteger(id))) {
    return NextResponse.json({ error: 'orderedIds must be an array of integers' }, { status: 400 })
  }
  await taskRunner.run(() => reorderRecipeSteps(recipe.id, body.orderedIds))
  return new NextResponse(null, { status: 204 })
}
