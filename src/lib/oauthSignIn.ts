import 'server-only'
import { after } from 'next/server'
import { findExistingOAuthUser, findOrCreateOAuthUser } from '@/lib/oauth'
import { hasAccess, emailHasInvite } from '@/lib/access'
import { joinWaitlist, normalizeEmail } from '@/lib/waitlist'
import { sendWaitlistNotificationEmail } from '@/lib/email'
import { reactivateAccount } from '@/lib/users'
import { getInviteByEmail } from '@/lib/invites'
import { recordAdminEvent } from '@/lib/adminSignals'
import { logInfo, captureError } from '@/lib/logger'

const WAITLIST_PATH = '/waitlist'

/**
 * Tells the admin an Invite was accepted. Only called right after this sign-in created the account
 * (the no-account branch), so it fires once per User; a later sign-in finds the account and never
 * reaches it. Deferred with `after()` (plain call when there is no request scope); never throws.
 */
function recordInviteAccepted(userId: number, email: string): void {
  const run = async () => {
    try {
      if (await getInviteByEmail(email)) await recordAdminEvent('invite-accepted', userId)
    } catch (error) {
      captureError(error, { area: 'admin-signals' })
    }
  }
  try {
    after(run)
  } catch {
    void run()
  }
}

export type OAuthSignInInput = {
  provider: string
  providerAccountId: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
  /** Raw `email_verified` claim: Google sends a boolean, Apple a boolean or the string "true"/"false". */
  emailVerified?: boolean | string | null
}

/**
 * Decides an OAuth (Google or Apple) sign-in under the invite-only lock (ADR-0032). Returns the
 * value for the Auth.js `signIn` callback: `true` to sign in, `false` to deny, or a path to
 * redirect to without creating a session.
 *
 * - Existing account with access (`hasAccess`): signs in, linking the provider if needed.
 * - Existing account without access (a Waitlisted User): no session, redirect to /waitlist.
 * - No account, email has an Invite: creates the account and signs in. No code is needed.
 * - No account, no Invite: creates no `users` or `oauth_accounts` row, adds one Waitlist Entry
 *   (same rules as `POST /api/waitlist`, so it is idempotent) and redirects to /waitlist.
 */
export async function resolveOAuthSignIn(input: OAuthSignInInput): Promise<boolean | string> {
  // ADR-0032 relies on the provider having verified the email. Only an explicit "not verified"
  // denies; an absent claim (Apple omits the email, and Apple relay addresses are verified) passes.
  if (input.email && (input.emailVerified === false || input.emailVerified === 'false')) {
    logInfo('OAuth sign-in denied: email not verified', { area: 'auth', provider: input.provider })
    return false
  }

  try {
    const existing = await findExistingOAuthUser(input)

    if (existing) {
      if (!(await hasAccess(existing.userId))) {
        logInfo('OAuth sign-in blocked: no invite', { area: 'auth', provider: input.provider })
        return WAITLIST_PATH
      }
      if (input.email) {
        // Link by the stored email so a casing difference can't create a second account.
        await findOrCreateOAuthUser({ ...input, email: existing.email, name: input.name ?? null, avatarUrl: input.avatarUrl ?? null })
      }
      if (existing.dateDeleted) await reactivateAccount(existing.userId)
      return true
    }

    // Apple omits the email after the first authorization; with no link either, there is nobody to admit.
    if (!input.email) return false

    if (await emailHasInvite(input.email)) {
      const userId = await findOrCreateOAuthUser({ ...input, email: input.email, name: input.name ?? null, avatarUrl: input.avatarUrl ?? null })
      recordInviteAccepted(userId, input.email)
      return true
    }

    const entry = { email: input.email, name: input.name ?? null, marketingEmailOptIn: false }
    const { created } = await joinWaitlist(entry)
    logInfo('OAuth sign-in added to waitlist', { area: 'auth', provider: input.provider, created })
    if (created) {
      // Same admin notification as POST /api/waitlist; the send guard (#324) keeps it from emailing outside production.
      await sendWaitlistNotificationEmail({
        email: normalizeEmail(entry.email),
        name: entry.name?.trim() || null,
        marketingEmailOptIn: false,
      }).catch((error) => captureError(error, { area: 'waitlist' }))
    }
    return WAITLIST_PATH
  } catch (error) {
    captureError(error, { area: 'auth', attributes: { provider: input.provider } })
    return false
  }
}
