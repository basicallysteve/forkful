import { NextResponse } from 'next/server'
import { createPasswordResetToken, getOAuthProvidersForEmail } from '@/lib/users'
import { sendPasswordResetEmail } from '@/lib/email'
import { taskRunner } from '@/lib/TaskRunner'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const body: { email?: string } = await request.json()

    if (!body.email || typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const email = body.email.toLowerCase().trim()

    const tokenResult = await taskRunner.run(() => createPasswordResetToken(email))

    if (tokenResult) {
      const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      const resetUrl = `${baseUrl}/reset-password?token=${tokenResult.token}`
      await sendPasswordResetEmail(email, resetUrl)
      return NextResponse.json({ type: 'success' })
    }

    // Token null: either OAuth-only user or email not found
    const providers = await getOAuthProvidersForEmail(email)
    if (providers.length > 0) {
      return NextResponse.json({ type: 'oauth', providers })
    }

    // Email not found — same response as success to prevent enumeration
    return NextResponse.json({ type: 'success' })
  } catch (error) {
    console.error('[forgot-password]', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
