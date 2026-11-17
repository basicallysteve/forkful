'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SIGN_IN_REQUIRED_MESSAGE } from '@/lib/api/errors'
import './sign-in-required-message.scss'

/**
 * The 401 message plus a way out: a Sign in link that returns to the current page (same
 * callbackUrl flow as the Signup Wall). It opens in a new tab so a half-filled form stays put.
 */
export default function SignInRequiredMessage() {
  const callbackUrl = encodeURIComponent(usePathname())
  return (
    <>
      {SIGN_IN_REQUIRED_MESSAGE}{' '}
      <Link href={`/login?callbackUrl=${callbackUrl}`} target="_blank" rel="noopener noreferrer" className="sign-in-required-link">
        Sign in
      </Link>
    </>
  )
}
