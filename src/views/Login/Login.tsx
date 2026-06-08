'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'

function Login() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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
      if (result?.error) {
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

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    await signIn(provider, { callbackUrl: '/' })
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
              <button
                type="button"
                className="oauth-button oauth-button--apple"
                onClick={() => handleOAuth('apple')}
              >
                <svg width="18" height="22" viewBox="0 0 814 1000" aria-hidden="true">
                  <path fill="#fff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-109.7C77 411.7 76.9 258 128.9 195.4c34-41.2 90.5-68.4 152.1-68.4 57.1 0 103.3 38.9 137.9 38.9 33.2 0 85.1-41.3 150.3-41.3 27.9 0 113.8 2.6 168.4 99.3zm-234-181.5c28.1-36.2 49.2-86.7 49.2-137.1 0-7.1-.6-14.3-1.9-20.1-46.5 1.7-101.5 31.4-134.8 71.9-26.4 30.8-51 81.2-51 132.3 0 7.8 1.3 15.5 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 41.5 0 93.9-28.1 123-66.4z"/>
                </svg>
                Continue with Apple
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
