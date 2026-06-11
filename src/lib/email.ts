import { Resend } from 'resend'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Forkful <noreply@forkful.app>',
    to,
    subject: 'Reset your Forkful password',
    react: PasswordResetEmail({ resetUrl }),
  })
}
