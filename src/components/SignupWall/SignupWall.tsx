'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The Signup Wall shown in place of a Recipe's Ingredients and Steps once an
 * Anonymous Visitor reaches the Recipe View Limit. The withheld content is not
 * present in the payload. See ADR-0020.
 */
export default function SignupWall() {
  const pathname = usePathname()
  const callbackUrl = encodeURIComponent(pathname)

  return (
    <section className="signup-wall" aria-label="Sign up to see the full recipe">
      <div className="signup-wall-inner">
        <h3 className="signup-wall-heading">Create a free account to see the full recipe</h3>
        <p className="signup-wall-tease">
          Get the full ingredient list, step-by-step instructions, and nutrition — free once you sign up.
        </p>
        <div className="signup-wall-actions">
          <Link href={`/create-account?callbackUrl=${callbackUrl}`} className="primary-button signup-wall-cta">
            Sign up free
          </Link>
          <Link href={`/login?callbackUrl=${callbackUrl}`} className="ghost-button signup-wall-login">
            Log in
          </Link>
        </div>
        <p className="signup-wall-note">You&rsquo;ve reached the free viewing limit.</p>
      </div>
    </section>
  )
}
