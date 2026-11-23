'use client'

import { useState } from 'react'
import { apiJoinWaitlist } from '@/lib/api/waitlist'
import styles from './Waitlist.module.scss'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVALID_EMAIL = 'Enter a valid email'

type Phase = 'idle' | 'loading' | 'done'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [optIn, setOptIn] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phase === 'loading') return
    if (!EMAIL_REGEX.test(email.trim())) {
      setError(INVALID_EMAIL)
      return
    }
    setError(null)
    setPhase('loading')
    try {
      await apiJoinWaitlist({ email: email.trim(), name: name.trim(), marketingEmailOptIn: optIn })
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('idle')
    }
  }

  if (phase === 'done') {
    return (
      <p className={styles.confirmation} role="status">
        You&apos;re on the list. We&apos;ll email you when your invite is ready.
      </p>
    )
  }

  const emailInvalid = error === INVALID_EMAIL

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field} htmlFor="waitlist-email">
        <span className={styles.label}>Email</span>
        <input
          id="waitlist-email"
          className="text-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={emailInvalid}
          aria-describedby={error ? 'waitlist-error' : undefined}
        />
      </label>

      <label className={styles.field} htmlFor="waitlist-name">
        <span className={styles.label}>Name (optional)</span>
        <input
          id="waitlist-name"
          className="text-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          maxLength={100}
        />
      </label>

      <label className={styles.checkbox} htmlFor="waitlist-optin">
        <input
          id="waitlist-optin"
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
        />
        <span>Send me occasional updates about what&apos;s coming</span>
      </label>

      {error && (
        <p id="waitlist-error" className={styles.error} role="alert">{error}</p>
      )}

      <button type="submit" className="primary-button" disabled={phase === 'loading'}>
        {phase === 'loading' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  )
}
