'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Password } from 'primereact/password'

const commonPasswords = [
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin', 'login',
]

interface PasswordValidation {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  isNotCommon: boolean
}

function validatePassword(password: string): PasswordValidation {
  const lower = password.toLowerCase()
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    isNotCommon: password.length === 0 || !commonPasswords.includes(lower),
  }
}

function isPasswordValid(v: PasswordValidation): boolean {
  return v.hasMinLength && v.hasUppercase && v.hasLowercase && v.hasNumber && v.hasSpecialChar && v.isNotCommon
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success' }
  | { phase: 'error'; message: string }

function ResetPassword() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update } = useSession()

  const token = searchParams.get('token')
  const isTokenMode = !!token

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })

  const validation = useMemo(() => validatePassword(newPassword), [newPassword])
  const passwordIsValid = useMemo(() => isPasswordValid(validation), [validation])
  const passwordsMatch = useMemo(
    () => newPassword === confirmPassword && confirmPassword.length > 0,
    [newPassword, confirmPassword],
  )
  const canSubmit = passwordIsValid && passwordsMatch && state.phase !== 'loading'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setState({ phase: 'loading' })
    try {
      const body = isTokenMode
        ? { token, newPassword }
        : { newPassword }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setState({ phase: 'error', message: data.error ?? 'Something went wrong' })
        return
      }

      if (!isTokenMode && data.passwordChangedAt) {
        // Forced mode: refresh the session to clear needsPasswordReset
        await update({ passwordChangedAt: data.passwordChangedAt })
        router.push('/')
        return
      }

      setState({ phase: 'success' })
    } catch {
      setState({ phase: 'error', message: 'Something went wrong. Please try again.' })
    }
  }

  const heading = isTokenMode ? 'Set a New Password' : 'Password Reset Required'
  const subheading = isTokenMode
    ? 'Choose a strong password for your account.'
    : 'Your password is over 90 days old. Please set a new one to continue.'

  return (
    <div className="login">
      <div className="account-content">
        <header className="account-header">
          <div>
            <p className="account-label">Account Security</p>
            <h2 className="account-name">{heading}</h2>
            <p className="account-helper">{subheading}</p>
          </div>
        </header>

        <section className="account-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">New Password</span>
            </div>
          </div>

          <div className="panel-content">
            {state.phase === 'success' && (
              <div className="success-message">
                <h2>Password updated</h2>
                <p>Your password has been changed. Please log in with your new password.</p>
                <Link href="/login" className="primary-button">Go to Login</Link>
              </div>
            )}

            {state.phase !== 'success' && (
              <form className="account-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className={`form-field form-field-full ${newPassword.length > 0 && !passwordIsValid ? 'has-error' : ''}`}>
                    <span className="field-label">New Password</span>
                    <Password
                      className={`password-input ${newPassword.length > 0 && !passwordIsValid ? 'input-error' : ''}`}
                      value={newPassword}
                      placeholder="Create a strong password"
                      onChange={(e) => setNewPassword(e.target.value)}
                      toggleMask
                      feedback
                      aria-describedby="password-requirements"
                      autoComplete="new-password"
                      autoFocus
                    />
                    <div id="password-requirements" className="password-requirements">
                      <span className={`requirement ${validation.hasMinLength ? 'valid' : ''}`}>✓ At least 8 characters</span>
                      <span className={`requirement ${validation.hasUppercase ? 'valid' : ''}`}>✓ One uppercase letter</span>
                      <span className={`requirement ${validation.hasLowercase ? 'valid' : ''}`}>✓ One lowercase letter</span>
                      <span className={`requirement ${validation.hasNumber ? 'valid' : ''}`}>✓ One number</span>
                      <span className={`requirement ${validation.hasSpecialChar ? 'valid' : ''}`}>✓ One special character</span>
                      <span className={`requirement ${validation.isNotCommon ? 'valid' : ''}`}>✓ Not a common password</span>
                    </div>
                  </label>

                  <label className={`form-field form-field-full ${confirmPassword.length > 0 && !passwordsMatch ? 'has-error' : ''}`}>
                    <span className="field-label">Confirm Password</span>
                    <Password
                      className={`password-input ${confirmPassword.length > 0 && !passwordsMatch ? 'input-error' : ''}`}
                      value={confirmPassword}
                      placeholder="Confirm your new password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      toggleMask
                      feedback={false}
                      aria-describedby={confirmPassword.length > 0 && !passwordsMatch ? 'confirm-error' : 'confirm-hint'}
                      autoComplete="new-password"
                    />
                    {confirmPassword.length > 0 && !passwordsMatch ? (
                      <span id="confirm-error" className="field-error" role="alert">Passwords do not match.</span>
                    ) : (
                      <span id="confirm-hint" className="field-hint">Re-enter your new password.</span>
                    )}
                  </label>
                </div>

                {state.phase === 'error' && (
                  <div className="form-error">{state.message}</div>
                )}

                <div className="form-footer">
                  <div className="footer-actions">
                    {isTokenMode && (
                      <Link href="/login" className="ghost-button">Cancel</Link>
                    )}
                    <button type="submit" className="primary-button" disabled={!canSubmit}>
                      {state.phase === 'loading' ? 'Saving…' : 'Set New Password'}
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

export default ResetPassword
