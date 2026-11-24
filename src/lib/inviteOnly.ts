import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'
import { logWarn } from '@/lib/logger'

/**
 * The `invite-only-access` Vercel flag (ADR-0032, amended by #374). On = waitlist mode: only
 * Invited Users get in. Off = open sign-up, as before the waitlist. Fails closed: the default is
 * on, so a missing flag or an unreachable Vercel never opens the product by accident.
 */
export const inviteOnlyAccess = flag<boolean>({
  key: 'invite-only-access',
  description: 'On: waitlist mode, only invited users can create accounts. Off: open sign-up.',
  defaultValue: true,
  options: [
    { value: true, label: 'Invite-only (waitlist)' },
    { value: false, label: 'Open sign-up' },
  ],
  adapter: vercelAdapter,
})

/**
 * The single reader of the flag. Everything that depends on the mode (the access lock, OAuth,
 * POST /api/users, the CTAs, /waitlist) calls this, so they can't disagree.
 *
 * `INVITE_ONLY_ACCESS` overrides the flag for local development and Preview, and fails closed:
 * when it is set and non-empty, only the exact string `false` opens sign-up. It is ignored when
 * `VERCEL_ENV` is `production`, which reads only the Vercel flag. Pass the request from
 * `proxy.ts`, where `next/headers` isn't available.
 */
export async function isInviteOnly(request?: { headers: Headers }): Promise<boolean> {
  const override = process.env.INVITE_ONLY_ACCESS
  if (override && process.env.VERCEL_ENV !== 'production') return override !== 'false'
  try {
    // The SDK only reads `request.headers`, so the narrow type is enough.
    const value = request ? await inviteOnlyAccess(request as Request) : await inviteOnlyAccess()
    return value !== false
  } catch {
    // Constant message, no detail: the SDK warns about the cause itself.
    logWarn('Invite-only flag unavailable, using waitlist mode', { area: 'auth' })
    return true
  }
}
