'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SignupWallProps {
  /** Number of ingredients in the withheld Recipe, for the tease. */
  ingredientCount: number
  /** Number of Recipe Steps in the withheld Recipe, for the tease. */
  stepCount: number
}

/**
 * The Signup Wall shown in place of a Recipe's Ingredients and Steps once an
 * Anonymous Visitor reaches the Recipe View Limit. The withheld content is not
 * present in the payload — this component only teases its size. See ADR-0020.
 */
export default function SignupWall({ ingredientCount, stepCount }: SignupWallProps) {
  const pathname = usePathname()
  const callbackUrl = encodeURIComponent(pathname)

  return (
    <section className="signup-wall" aria-label="Sign up to see the full recipe">
      <div className="signup-wall-inner">
        <h3 className="signup-wall-heading">Create a free account to see the full recipe</h3>
        <p className="signup-wall-tease">
          {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'} and {stepCount} step
          {stepCount === 1 ? '' : 's'}, plus full nutrition — free once you sign up.
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
