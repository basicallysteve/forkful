import crypto from 'crypto'
import { Resend } from 'resend'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'
import { GoodbyeEmail } from '@/emails/GoodbyeEmail'
import { DeactivationExpiryWarningEmail } from '@/emails/DeactivationExpiryWarningEmail'
import { PantryReminderEmail } from '@/emails/PantryReminderEmail'
import { RecipeSuggestionEmail } from '@/emails/RecipeSuggestionEmail'
import { NewUserNotificationEmail } from '@/emails/NewUserNotificationEmail'
import { ReviewReportSummaryEmail } from '@/emails/ReviewReportSummaryEmail'
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
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Reset your EatForkful password',
    react: PasswordResetEmail({ resetUrl, trackingPixelUrl }),
  })
}

export async function sendGoodbyeEmail({ to, username, action }: { to: string; username: string; action: 'deactivated' | 'deleted' }): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : undefined
  const trackingPixelUrl = makeTrackingPixelUrl()
  const subject = action === 'deactivated'
    ? 'Your EatForkful account has been deactivated'
    : 'Your EatForkful account has been deleted'

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject,
    react: GoodbyeEmail({ username, action, reactivateUrl, trackingPixelUrl }),
  })
}

export async function sendPantryReminderEmail({ to, username, items, pantryUrl }: {
  to: string;
  username: string;
  items: Array<{ name: string; expirationDate: string; daysUntilExpiry: number }>;
  pantryUrl: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const trackingPixelUrl = makeTrackingPixelUrl()

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Items in your pantry are expiring soon',
    react: PantryReminderEmail({ username, items, pantryUrl, trackingPixelUrl }),
  })
}

export async function sendRecipeSuggestionEmail({ to, username, recipes, baseUrl }: {
  to: string;
  username: string;
  recipes: Array<{ name: string; description: string | null; cuisineType: string | null; shortId: string; slug: string }>;
  baseUrl: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const trackingPixelUrl = makeTrackingPixelUrl()

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Recipe ideas picked for you',
    react: RecipeSuggestionEmail({ username, recipes, baseUrl, trackingPixelUrl }),
  })
}

export async function sendDeactivationExpiryWarningEmail({ to, username, deletionDate }: { to: string; username: string; deletionDate: Date }): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : 'https://eatforkful.com/login'
  const trackingPixelUrl = makeTrackingPixelUrl()
  const formatted = deletionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Your EatForkful account will be deleted soon',
    react: DeactivationExpiryWarningEmail({ username, deletionDate: formatted, reactivateUrl, trackingPixelUrl }),
  })
}

export async function sendReviewReportSummaryEmail({ to, reportCount, reports, adminUrl }: {
  to: string;
  reportCount: number;
  reports: Array<{
    reason: string
    reviewAuthor: string | null
    reviewRating: number
    reviewBody: string | null
    reportedAt: string
    reporterUsername: string | null
    reportComment: string | null
  }>;
  adminUrl: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: `${reportCount} new review report${reportCount !== 1 ? 's' : ''} on EatForkful`,
    react: ReviewReportSummaryEmail({ reportCount, reports, adminUrl }),
  })
}

export async function sendUserAccountCreationEmail(username: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to: "steven@eatforkful.com",
    subject: 'New user signed up',
    react: NewUserNotificationEmail({ username }),
  })
}

