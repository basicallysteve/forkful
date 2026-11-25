import crypto from 'crypto'
import { Resend } from 'resend'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'
import { GoodbyeEmail } from '@/emails/GoodbyeEmail'
import { DeactivationExpiryWarningEmail } from '@/emails/DeactivationExpiryWarningEmail'
import { PantryReminderEmail } from '@/emails/PantryReminderEmail'
import { RecipeSuggestionEmail } from '@/emails/RecipeSuggestionEmail'
import { NewUserNotificationEmail } from '@/emails/NewUserNotificationEmail'
import { ReviewReportSummaryEmail } from '@/emails/ReviewReportSummaryEmail'
import { WaitlistNotificationEmail } from '@/emails/WaitlistNotificationEmail'
import { InviteEmail } from '@/emails/InviteEmail'
import { buildInviteLink } from '@/lib/inviteLink'
import { WaitlistNoticeEmail, waitlistNoticeText } from '@/emails/WaitlistNoticeEmail'
import { absoluteUrl } from '@/lib/seo'
import { signWaitlistLeaveToken } from '@/lib/waitlist'
import { logInfo } from '@/lib/logger'

type EmailPayload = Parameters<Resend['emails']['send']>[0]
// Resend resolves { data: null, error } on API failures instead of throwing. Most callers
// ignore this result; sendInviteEmail checks it. undefined means the send was suppressed.
type SendResult = Awaited<ReturnType<Resend['emails']['send']>> | undefined

/**
 * Single choke point for outgoing email. RESEND_API_KEY is the production key and is
 * used only when VERCEL_ENV === 'production' exactly (unset, preview, development and
 * typos all fail safe). Outside production, if RESEND_SANDBOX_API_KEY is set the email
 * goes through a client built with that key; otherwise it is logged and skipped.
 * Log the template only, never the recipient.
 */
async function deliver(template: string, payload: EmailPayload): Promise<SendResult> {
  if (process.env.VERCEL_ENV === 'production') {
    return await new Resend(process.env.RESEND_API_KEY).emails.send(payload)
  }
  const sandboxKey = process.env.RESEND_SANDBOX_API_KEY
  if (!sandboxKey) {
    logInfo('Email suppressed outside production', { template })
    return
  }
  logInfo('Email sent via sandbox key outside production', { template })
  return await new Resend(sandboxKey).emails.send(payload)
}

function makeTrackingPixelUrl(): string | undefined {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (!baseUrl) return undefined
  const trackingId = crypto.randomUUID()
  return `${baseUrl}/api/track/email-open?id=${trackingId}`
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const trackingPixelUrl = makeTrackingPixelUrl()

  await deliver('password-reset', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Reset your EatForkful password',
    react: PasswordResetEmail({ resetUrl, trackingPixelUrl }),
  })
}

export async function sendGoodbyeEmail({ to, username, action }: { to: string; username: string; action: 'deactivated' | 'deleted' }): Promise<void> {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : undefined
  const trackingPixelUrl = makeTrackingPixelUrl()
  const subject = action === 'deactivated'
    ? 'Your EatForkful account has been deactivated'
    : 'Your EatForkful account has been deleted'

  await deliver('goodbye', {
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
  const trackingPixelUrl = makeTrackingPixelUrl()

  await deliver('pantry-reminder', {
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
  const trackingPixelUrl = makeTrackingPixelUrl()

  await deliver('recipe-suggestion', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: 'Recipe ideas picked for you',
    react: RecipeSuggestionEmail({ username, recipes, baseUrl, trackingPixelUrl }),
  })
}

export async function sendDeactivationExpiryWarningEmail({ to, username, deletionDate }: { to: string; username: string; deletionDate: Date }): Promise<void> {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const reactivateUrl = baseUrl ? `${baseUrl}/login` : 'https://eatforkful.com/login'
  const trackingPixelUrl = makeTrackingPixelUrl()
  const formatted = deletionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  await deliver('deactivation-expiry-warning', {
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
  await deliver('review-report-summary', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: `${reportCount} new review report${reportCount !== 1 ? 's' : ''} on EatForkful`,
    react: ReviewReportSummaryEmail({ reportCount, reports, adminUrl }),
  })
}

// Unused during the waitlist period (the waitlist notification replaces it); kept for the move to the full application.
export async function sendUserAccountCreationEmail(username: string): Promise<void> {

  await deliver('new-user-notification', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to: "steven@eatforkful.com",
    subject: 'New user signed up',
    react: NewUserNotificationEmail({ username }),
  })
}

export async function sendWaitlistNotificationEmail(entry: { email: string; name: string | null; marketingEmailOptIn: boolean }): Promise<void> {
  await deliver('waitlist-notification', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to: 'steven@eatforkful.com',
    subject: 'Someone joined the waitlist',
    react: WaitlistNotificationEmail(entry),
  })
}

/** The leave link carries a signed token; the address and username stay out of logs. */
export async function sendWaitlistNoticeEmail({ to, username }: { to: string; username: string }): Promise<void> {
  const leaveUrl = absoluteUrl(`/waitlist/leave?${new URLSearchParams({ token: signWaitlistLeaveToken(to) })}`)
  const result = await deliver('waitlist-notice', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: "You're on the EatForkful waitlist",
    react: WaitlistNoticeEmail({ username, leaveUrl }),
    // Plain-text alternative: a text email can't carry a link label, so it shows the raw URL.
    text: waitlistNoticeText(username, leaveUrl),
  })
  if (result?.error) {
    throw new Error(`Waitlist notice send failed: ${result.error.name} (${result.error.statusCode ?? 'no status'})`)
  }
}

/** The single-use code travels only in the link inside the email body; it is never logged. */
export async function sendInviteEmail({ to, code }: { to: string; code: string }): Promise<void> {
  const result = await deliver('invite', {
    from: process.env.RESEND_FROM_EMAIL ?? 'EatForkful <noreply@eatforkful.com>',
    to,
    subject: "You're invited to EatForkful",
    react: InviteEmail({ inviteUrl: buildInviteLink(to, code) }),
  })
  if (result?.error) {
    // Only the Resend error name and status: its message may echo the address or payload.
    throw new Error(`Invite email send failed: ${result.error.name} (${result.error.statusCode ?? 'no status'})`)
  }
}
