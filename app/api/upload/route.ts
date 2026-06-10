import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getSessionUser } from '@/lib/auth'

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  // WebP: "RIFF????WEBP"
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  // Validate by magic bytes — don't trust the client-reported MIME type.
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detectedType = detectImageType(header)
  if (!detectedType) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const ext = detectedType === 'image/jpeg' ? 'jpg' : detectedType.split('/')[1]
  const filename = `recipe-steps/${crypto.randomUUID()}.${ext}`
  const blob = await put(filename, file, {
    access: 'public',
    contentType: detectedType,
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
