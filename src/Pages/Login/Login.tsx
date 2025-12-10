import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useSettingsStore } from "@/stores/settings"
import "./login.scss"

function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const setUser = useSettingsStore((state) => state.setUser)

  const canSubmit = useMemo(() => {
    return usernameOrEmail.trim().length > 0 && password.length > 0
  }, [usernameOrEmail, password])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    
    // TODO: Replace with actual authentication logic
    // For now, create a mock user and store it in the settings store
    const isEmail = usernameOrEmail.includes('@')
    setUser({
      user_id: `user_${Date.now()}`, // Temporary mock ID
      username: isEmail ? usernameOrEmail.split('@')[0] : usernameOrEmail,
      email: isEmail ? usernameOrEmail : `${usernameOrEmail}@example.com`,
    })
    
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="login">
        <div className="account-titlebar" aria-hidden="true">
          <span className="title">Forkful — Logged In</span>
        </div>
        <div className="account-content">
          <div className="success-message">
            <h2>Welcome back! 👋</h2>
            <p>You have successfully logged in.</p>
            <Link to="/" className="primary-button">Go to Home</Link>
          </div>
        </div>
      </div>
    )
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
                  <span className="field-label">Username or Email</span>
                  <input
                    className="text-input"
                    type="text"
                    value={usernameOrEmail}
                    placeholder="Enter your username or email"
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    aria-describedby="username-hint"
                    autoComplete="username"
                  />
                  <span id="username-hint" className="field-hint">
                    Enter your username or email address.
                  </span>
                </label>

                <label className="form-field form-field-full">
                  <span className="field-label">Password</span>
                  <input
                    className="text-input"
                    type="password"
                    value={password}
                    placeholder="Enter your password"
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="password-hint"
                    autoComplete="current-password"
                  />
                  <span id="password-hint" className="field-hint">
                    Enter your password.
                  </span>
                </label>
              </div>

              <div className="form-footer">
                <div className="footer-actions">
                  <Link to="/" className="ghost-button">Cancel</Link>
                  <button type="submit" className="primary-button" disabled={!canSubmit}>
                    Login
                  </button>
                </div>
              </div>
            </form>

            <div className="form-links">
              <p>
                <Link to="/forgot-password">Forgot Password?</Link>
              </p>
              <p>
                Don't have an account? <Link to="/create-account">Create Account</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Login
