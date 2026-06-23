import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth'
import { getUser, updateUserAvatar, deleteUserAvatar } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'
import { encrypt, SESSION_DURATION_MS } from '@/lib/session'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_SIZE = 2 * 1024 * 1024

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function validateMagicBytes(file: File): Promise<boolean> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  // WebP: RIFF????WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  return false
}

async function reissueSession(sessionUser: { userId: number; username: string }, avatarUrl: string | null) {
  const secure = process.env.NODE_ENV === 'production'
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const cookieStore = await cookies()
  const token = await encrypt({ userId: sessionUser.userId, username: sessionUser.username, avatarUrl })
  cookieStore.set('session', token, { httpOnly: true, secure, sameSite: 'strict', expires: expiresAt })
}

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
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 })
  }
  if (!(await validateMagicBytes(file))) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
  }

  const user = await getUser(targetId)
  const oldAvatarUrl = user?.avatarUrl ?? null

  const { put } = await import('@vercel/blob')
  const ext = EXT_MAP[file.type]
  const blob = await put(`avatars/${targetId}-${Date.now()}.${ext}`, file, { access: 'public', contentType: file.type })

  await taskRunner.run(() => updateUserAvatar({ userId: targetId, avatarUrl: blob.url, oldAvatarUrl }))
  await reissueSession(sessionUser, blob.url)

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
  await reissueSession(sessionUser, null)

  return NextResponse.json({ ok: true })
}
