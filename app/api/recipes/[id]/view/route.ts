import { NextResponse } from 'next/server'
import { incrementRecipeView } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ id: string }> }

/**
 * Records a Recipe View Count increment. Fired as a best-effort beacon from the
 * recipe detail page on mount. Counts anonymous and logged-in views (including
 * gated ones) but excludes the Recipe author's own views. See ADR-0020.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSessionUser()
  await taskRunner.run(() => incrementRecipeView(id, session?.userId))
  return new NextResponse(null, { status: 204 })
}
