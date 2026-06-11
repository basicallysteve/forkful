import { NextResponse } from 'next/server'
import { createPasswordResetToken, getOAuthProvidersForEmail, checkPasswordResetRateLimit, trackLoginAttempt } from '@/lib/users'
import { sendPasswordResetEmail } from '@/lib/email'
import { taskRunner } from '@/lib/TaskRunner'
import { getClientIp } from '@/lib/ip'

export async function POST(request: Request) {
  const ipAddress = getClientIp(request.headers)

  try {
    await checkPasswordResetRateLimit(ipAddress)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Too many requests'
    return NextResponse.json({ error: message }, { status: 429 })
  }

  try {
    await trackLoginAttempt({ ipAddress, successful: true })

    const body: { email?: string } = await request.json()

    if (!body.email || typeof body.email !== 'string' || body.email.length > 254 || !body.email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const email = body.email.toLowerCase().trim()

    const tokenResult = await taskRunner.run(() => createPasswordResetToken(email))

    if (tokenResult) {
      const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
      if (!baseUrl) throw new Error('AUTH_URL or NEXTAUTH_URL env var must be set')
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
