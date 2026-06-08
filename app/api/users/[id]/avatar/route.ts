import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getUser, updateUserAvatar, deleteUserAvatar } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const targetId = Number(id)
  if (isNaN(targetId) || sessionUser.userId !== targetId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 })
  }

  const user = await getUser(targetId)
  const oldAvatarUrl = user?.avatarUrl ?? null

  const { put } = await import('@vercel/blob')
  const ext = file.type.split('/')[1]
  const blob = await put(`avatars/${targetId}-${Date.now()}.${ext}`, file, { access: 'public' })

  await taskRunner.run(() => updateUserAvatar(targetId, blob.url, oldAvatarUrl))

  return NextResponse.json({ url: blob.url })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const targetId = Number(id)
  if (isNaN(targetId) || sessionUser.userId !== targetId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await getUser(targetId)
  const oldAvatarUrl = user?.avatarUrl ?? null

  await taskRunner.run(() => deleteUserAvatar(targetId, oldAvatarUrl))

  return NextResponse.json({ ok: true })
}
