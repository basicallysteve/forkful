import * as Sentry from '@sentry/nextjs'

/**
 * Opens the Sentry User Feedback form programmatically.
 *
 * Returns `true` if the form was opened, `false` if the feedback integration
 * isn't available (e.g. Sentry disabled or no DSN configured) so callers can
 * fall back to another channel.
 */
export async function openFeedbackForm(): Promise<boolean> {
  const feedback = Sentry.getFeedback()
  if (!feedback) return false

  const form = await feedback.createForm()
  form.appendToDom()
  form.open()
  return true
}
