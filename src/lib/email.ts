import crypto from 'crypto'
import { Resend } from 'resend'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Generate a unique tracking ID for this send so opens can be counted.
  const trackingId = crypto.randomUUID()
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const trackingPixelUrl = baseUrl
    ? `${baseUrl}/api/track/email-open?id=${trackingId}`
    : undefined

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Forkful <noreply@eatforkful.com>',
    to,
    subject: 'Reset your Forkful password',
    react: PasswordResetEmail({ resetUrl, trackingPixelUrl }),
  })
}
