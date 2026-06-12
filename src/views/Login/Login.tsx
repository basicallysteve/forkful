'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { apiReactivateAccount } from '@/lib/api/users'

function Login() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReactivate, setShowReactivate] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0
  }, [username, password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,
      })
      if (result?.code === 'ACCOUNT_DEACTIVATED') {
        setShowReactivate(true)
      } else if (result?.error) {
        setError('Invalid username or password')
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError("An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleReactivate() {
    setReactivating(true)
    setError(null)
    try {
      await apiReactivateAccount(username.trim(), password)
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('Reactivation succeeded but sign-in failed. Please try logging in again.')
        setShowReactivate(false)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reactivation failed')
    } finally {
      setReactivating(false)
    }
  }

  async function handleOAuth(provider: 'google') {
    setError(null)
    await signIn(provider, { callbackUrl: '/' })
  }

  if (showReactivate) {
    return (
      <div className="login">
        <div className="account-content">
          <header className="account-header">
            <div>
              <p className="account-label">Account Deactivated</p>
              <h2 className="account-name">Welcome back</h2>
              <p className="account-helper">
                Your account is currently deactivated. Would you like to reactivate it?
              </p>
            </div>
          </header>
          <section className="account-panel">
            <div className="panel-content">
              {error && <div className="form-error">{error}</div>}
              <div className="form-footer">
                <div className="footer-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => { setShowReactivate(false); setError(null) }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleReactivate}
                    disabled={reactivating}
                  >
                    {reactivating ? 'Reactivating…' : 'Yes, reactivate my account'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="login">
      <div className="account-content">
        <header className="account-header">
          <div>
            <p className="account-label">Welcome Back</p>
            <h2 className="account-name">Login to Your Account</h2>
            <p className="account-helper">
              Access your saved recipes and meal plans.
            </p>
          </div>
        </header>

        <section className="account-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Login</span>
            </div>
          </div>

          <div className="panel-content">
            <div className="oauth-buttons">
              <button
                type="button"
                className="oauth-button oauth-button--google"
                onClick={() => handleOAuth('google')}
              >
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.3 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 11.9 2 2 11.9 2 24s9.9 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="oauth-divider">
              <span>or</span>
            </div>

            <form className="account-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="form-field form-field-full">
                  <span className="field-label">Username</span>
                  <InputText
                    type="text"
                    value={username}
                    placeholder="Enter your username"
                    onChange={(e) => setUsername(e.target.value)}
                    aria-describedby="username-hint"
                    autoComplete="username"
                  />
                  <span id="username-hint" className="field-hint">
                    Enter your username.
                  </span>
                </label>

                <label className="form-field form-field-full">
                  <span className="field-label">Password</span>
                  <Password
                    value={password}
                    placeholder="Enter your password"
                    onChange={(e) => setPassword(e.target.value)}
                    toggleMask
                    feedback={false}
                    aria-describedby="password-hint"
                    autoComplete="current-password"
                  />
                  <span id="password-hint" className="field-hint">
                    Enter your password.
                  </span>
                </label>
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="form-footer">
                <div className="footer-actions">
                  <Link href="/" className="ghost-button">Cancel</Link>
                  <button type="submit" className="primary-button" disabled={!canSubmit || loading}>
                    {loading ? 'Logging in…' : 'Login'}
                  </button>
                </div>
              </div>
            </form>

            <div className="form-links">
              <p>
                <Link href="/forgot-password">Forgot Password?</Link>
              </p>
              <p>
                Don't have an account? <Link href="/create-account">Create Account</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Login
