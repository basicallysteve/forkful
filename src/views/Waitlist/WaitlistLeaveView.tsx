'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './Waitlist.module.scss'

export default function WaitlistLeaveView({ status, focusOnMount = false, deactivated = false }: { status: 'removed' | 'invalid'; focusOnMount?: boolean; deactivated?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Only when it replaces the button after a removal, so keyboard users keep their place.
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus()
  }, [focusOnMount])

  return (
    <div className={styles.page}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {status === 'invalid' ? 'This link is invalid' : deactivated ? 'Your account has been deactivated' : "You've been removed from the waitlist"}
      </h1>
      <p className={styles.lead}>
        {status === 'invalid'
          ? 'It may have been copied incompletely. Open the link from your email again.'
          : deactivated
            ? "You're off the waitlist. We'll permanently delete your data after 12 months unless you sign in and reactivate your account."
            : "We've deleted your email from the list and won't send you anything more about it."}
      </p>
      <Link href="/" className="ghost-button">Back to EatForkful</Link>
    </div>
  )
}
