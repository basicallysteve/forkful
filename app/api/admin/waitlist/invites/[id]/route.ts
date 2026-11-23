import { NextResponse } from 'next/server'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { revokeInvite } from '@/lib/invites'
import { isValidDbId } from '@/lib/dbId'
import { captureError } from '@/lib/logger'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number((await params).id)
  if (!isValidDbId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    if (!(await revokeInvite(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureError(error, { area: 'waitlist' })
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
