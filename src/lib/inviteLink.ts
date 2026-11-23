import { absoluteUrl } from '@/lib/seo'

/** Query-param names on the Invite link. The create-account page (#381) reads these same names. */
export const INVITE_LINK_PARAMS = { email: 'email', code: 'code' } as const

/** `/create-account?email=<urlencoded>&code=<code>` on the site origin (ADR-0032). */
export function buildInviteLink(email: string, code: string): string {
  const params = new URLSearchParams({
    [INVITE_LINK_PARAMS.email]: email,
    [INVITE_LINK_PARAMS.code]: code,
  })
  return absoluteUrl(`/create-account?${params.toString()}`)
}
