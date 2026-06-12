import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAccountFeedback } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'

const VALID_ACTIONS = new Set(['deactivated', 'deleted'])
const VALID_REASONS = new Set([
  'Not using it enough',
  'Missing features',
  'Privacy concerns',
  'Switching to another app',
  'Other',
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const targetId = Number(id)
  if (isNaN(targetId) || sessionUser.userId !== targetId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!VALID_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (!Array.isArray(body.reasons) || body.reasons.some((r: unknown) => typeof r !== 'string' || !VALID_REASONS.has(r))) {
      return NextResponse.json({ error: 'Invalid reasons' }, { status: 400 })
    }
    if (body.comment !== undefined && body.comment !== null && typeof body.comment !== 'string') {
      return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }

    await taskRunner.run(() => createAccountFeedback({
      userId: targetId,
      action: body.action,
      reasons: body.reasons,
      comment: body.comment ?? undefined,
    }))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
