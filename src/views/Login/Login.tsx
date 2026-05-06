'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiLogin } from "@/lib/api/users"
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'

function Login() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0
  }, [username, password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    try {
      await apiLogin({ username, password })
      router.push("/")
      router.refresh()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unknown error occurred")
      }
    }
  }

  return (
    <div className="login">
      <div className="account-titlebar" aria-hidden="true">
        <span className="title">Forkful — Login</span>
      </div>

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
                  <button type="submit" className="primary-button" disabled={!canSubmit}>
                    Login
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
