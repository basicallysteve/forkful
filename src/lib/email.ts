import crypto from 'crypto'
import { Resend } from 'resend'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'
import { GoodbyeEmail } from '@/emails/GoodbyeEmail'
import { DeactivationExpiryWarningEmail } from '@/emails/DeactivationExpiryWarningEmail'

function makeTrackingPixelUrl(): string | undefined {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (!baseUrl) return undefined
  const trackingId = crypto.randomUUID()
  return `${baseUrl}/api/track/email-open?id=${trackingId}`
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const trackingPixelUrl = makeTrackingPixelUrl()

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Forkful <noreply@eatforkful.com>',
    to,
    subject: 'Reset your Forkful password',
    react: PasswordResetEmail({ resetUrl, trackingPixelUrl }),
  })
}

export async function sendGoodbyeEmail(to: string, username: string, action: 'deactivated' | 'deleted'): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : undefined
  const trackingPixelUrl = makeTrackingPixelUrl()
  const subject = action === 'deactivated'
    ? 'Your Forkful account has been deactivated'
    : 'Your Forkful account has been deleted'

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Forkful <noreply@eatforkful.com>',
    to,
    subject,
    react: GoodbyeEmail({ username, action, reactivateUrl, trackingPixelUrl }),
  })
}

export async function sendDeactivationExpiryWarningEmail(to: string, username: string, deletionDate: Date): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : 'https://eatforkful.com/login'
  const trackingPixelUrl = makeTrackingPixelUrl()
  const formatted = deletionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Forkful <noreply@eatforkful.com>',
    to,
    subject: 'Your Forkful account will be deleted soon',
    react: DeactivationExpiryWarningEmail({ username, deletionDate: formatted, reactivateUrl, trackingPixelUrl }),
  })
}
