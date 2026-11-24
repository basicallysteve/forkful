'use client'

import Link from 'next/link'
import { useInviteOnly } from '@/components/InviteOnlyProvider'

/**
 * The public sign-up call to action, switched by the `invite-only-access` flag (ADR-0032, #374):
 * "Join the waitlist" to /waitlist while invite-only, otherwise `openLabel` to /create-account
 * (the pre-waitlist wording). A client component so server-rendered views (Home) can use it.
 */
export default function SignupCta({ className, openLabel }: { className?: string; openLabel: string }) {
  const inviteOnly = useInviteOnly()
  return inviteOnly
    ? <Link href="/waitlist" className={className}>Join the waitlist</Link>
    : <Link href="/create-account" className={className}>{openLabel}</Link>
}
