'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success' }
  | { phase: 'oauth'; providers: string[] }
  | { phase: 'error'; message: string }

function providerLabel(provider: string): string {
  if (provider === 'google') return 'Google'
  if (provider === 'apple') return 'Apple'
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })

  const isValidEmail = useMemo(() => EMAIL_REGEX.test(email), [email])
  const canSubmit = isValidEmail && state.phase !== 'loading'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setState({ phase: 'loading' })
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ phase: 'error', message: data.error ?? 'Something went wrong' })
        return
      }
      if (data.type === 'oauth') {
        setState({ phase: 'oauth', providers: data.providers })
      } else {
        setState({ phase: 'success' })
      }
    } catch {
      setState({ phase: 'error', message: 'Something went wrong. Please try again.' })
    }
  }

  return (
    <div className="login">
      <div className="account-content">
        <header className="account-header">
          <div>
            <p className="account-label">Account Recovery</p>
            <h2 className="account-name">Forgot Your Password?</h2>
            <p className="account-helper">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>
        </header>

        <section className="account-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Reset Password</span>
            </div>
          </div>

          <div className="panel-content">
            {state.phase === 'success' && (
              <div className="success-message">
                <h2>Check your email</h2>
                <p>
                  If that address is registered, you&apos;ll receive a reset link shortly.
                  The link expires in 1&nbsp;hour.
                </p>
                <Link href="/login" className="primary-button">Back to Login</Link>
              </div>
            )}

            {state.phase === 'oauth' && (
              <div className="success-message">
                <h2>No password on this account</h2>
                <p>
                  This account uses{' '}
                  {state.providers.map(providerLabel).join(' and ')}{' '}
                  sign-in — there&apos;s no password to reset.
                  Sign in with your provider instead.
                </p>
                <Link href="/login" className="primary-button">Back to Login</Link>
              </div>
            )}

            {(state.phase === 'idle' || state.phase === 'loading' || state.phase === 'error') && (
              <form className="account-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className={`form-field form-field-full ${email.length > 0 && !isValidEmail ? 'has-error' : ''}`}>
                    <span className="field-label">Email Address</span>
                    <InputText
                      type="email"
                      value={email}
                      placeholder="you@example.com"
                      onChange={(e) => setEmail(e.target.value)}
                      aria-describedby="email-hint"
                      autoComplete="email"
                      autoFocus
                    />
                    <span id="email-hint" className="field-hint">
                      Enter the email address associated with your account.
                    </span>
                  </label>
                </div>

                {state.phase === 'error' && (
                  <div className="form-error">{state.message}</div>
                )}

                <div className="form-footer">
                  <div className="footer-actions">
                    <Link href="/login" className="ghost-button">Back to Login</Link>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={!canSubmit}
                    >
                      {state.phase === 'loading' ? 'Sending…' : 'Send Reset Link'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ForgotPassword
