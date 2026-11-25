'use client'

import { useState } from 'react'
import WaitlistLeaveView from './WaitlistLeaveView'
import styles from './Waitlist.module.scss'

type Phase = 'confirm' | 'loading' | 'removed' | 'invalid'

/** Confirmation step for the leave link. Nothing is removed until the button POSTs the token. */
export default function WaitlistLeaveConfirm({ token, deactivates = false }: { token: string; deactivates?: boolean }) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (phase === 'loading') return
    setError(null)
    setPhase('loading')
    try {
      const res = await fetch('/api/waitlist/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'same-origin',
      }).catch(() => null)
      if (!res) throw new Error('network')
      if (res.ok) {
        setPhase('removed')
      } else if (res.status === 400) {
        setPhase('invalid')
      } else {
        throw new Error('failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setPhase('confirm')
    }
  }

  if (phase === 'removed' || phase === 'invalid') return <WaitlistLeaveView status={phase} focusOnMount deactivated={deactivates} />

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{deactivates ? 'Leave the waitlist and deactivate your account?' : 'Leave the waitlist?'}</h1>
      <p className={styles.lead}>
        {deactivates
          ? 'Your account will be deactivated and you will be taken off the waitlist. Your recipes, pantry and food log are kept for 12 months, then permanently deleted unless you sign in and reactivate.'
          : "We'll delete your email from the list and won't send you anything more about it."}
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="button" className="primary-button" onClick={handleRemove} disabled={phase === 'loading'}>
        {phase === 'loading' ? (deactivates ? 'Deactivating…' : 'Removing…') : deactivates ? 'Leave and deactivate my account' : 'Remove me from the waitlist'}
      </button>
    </div>
  )
}
