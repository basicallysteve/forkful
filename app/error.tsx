'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import styles from './error.module.scss'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  function openFeedback() {
    const feedback = Sentry.getFeedback()
    if (feedback) {
      feedback.openDialog()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>
          An unexpected error occurred. You can try again or let us know what happened.
        </p>
        <div className={styles.actions}>
          <button className="primary-button" onClick={reset}>
            Try again
          </button>
          <button className="ghost-button" onClick={openFeedback}>
            Report issue
          </button>
        </div>
      </div>
    </div>
  )
}
