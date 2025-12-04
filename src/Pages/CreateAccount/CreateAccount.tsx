import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import "./createAccount.scss"

const cuisineOptions = ["Caribbean", "Italian", "Mexican", "Asian", "American", "Mediterranean", "Indian", "Other"]
const dietaryOptions = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Low-Carb"]

interface PasswordValidation {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

function validatePassword(password: string): PasswordValidation {
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }
}

function isPasswordValid(validation: PasswordValidation): boolean {
  return (
    validation.hasMinLength &&
    validation.hasUppercase &&
    validation.hasLowercase &&
    validation.hasNumber &&
    validation.hasSpecialChar
  )
}

function CreateAccount() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>("")
  const [submitted, setSubmitted] = useState(false)

  const passwordValidation = useMemo(() => validatePassword(password), [password])
  const passwordIsValid = useMemo(() => isPasswordValid(passwordValidation), [passwordValidation])
  const passwordsMatch = useMemo(() => password === confirmPassword && confirmPassword.length > 0, [password, confirmPassword])

  const isValidEmail = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }, [email])

  const canSubmit = useMemo(() => {
    return (
      username.trim().length >= 3 &&
      isValidEmail &&
      passwordIsValid &&
      passwordsMatch
    )
  }, [username, isValidEmail, passwordIsValid, passwordsMatch])

  function handleCuisineToggle(cuisine: string) {
    if (cuisinePreferences.includes(cuisine)) {
      setCuisinePreferences(cuisinePreferences.filter((c) => c !== cuisine))
    } else {
      setCuisinePreferences([...cuisinePreferences, cuisine])
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    
    // For now, just show success message
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="create-account">
        <div className="account-titlebar" aria-hidden="true">
          <span className="title">Forkful — Account Created</span>
        </div>
        <div className="account-content">
          <div className="success-message">
            <h2>Welcome to Forkful! 🎉</h2>
            <p>Your account has been created successfully.</p>
            <Link to="/" className="primary-button">Go to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="create-account">
      <div className="account-titlebar" aria-hidden="true">
        <span className="title">Forkful — Create Account</span>
      </div>

      <div className="account-content">
        <header className="account-header">
          <div>
            <p className="account-label">Get Started</p>
            <h2 className="account-name">Create Your Account</h2>
            <p className="account-helper">
              Join Forkful to save recipes, create meal plans, and discover delicious dishes.
            </p>
          </div>
        </header>

        <section className="account-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active" role="button">Account Details</span>
            </div>
          </div>

          <div className="panel-content">
            <form className="account-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="form-field">
                  <span className="field-label">Username</span>
                  <input
                    className="text-input"
                    type="text"
                    value={username}
                    placeholder="Choose a username"
                    onChange={(e) => setUsername(e.target.value)}
                    aria-describedby="username-hint"
                    autoComplete="username"
                  />
                  <span id="username-hint" className="field-hint">
                    At least 3 characters.
                  </span>
                </label>

                <label className={`form-field ${email.length > 0 && !isValidEmail ? 'has-error' : ''}`}>
                  <span className="field-label">Email</span>
                  <input
                    className={`text-input ${email.length > 0 && !isValidEmail ? 'input-error' : ''}`}
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={email.length > 0 && !isValidEmail}
                    aria-describedby={email.length > 0 && !isValidEmail ? "email-error" : "email-hint"}
                    autoComplete="email"
                  />
                  {email.length > 0 && !isValidEmail ? (
                    <span id="email-error" className="field-error" role="alert">
                      Please enter a valid email address.
                    </span>
                  ) : (
                    <span id="email-hint" className="field-hint">
                      We'll never share your email.
                    </span>
                  )}
                </label>

                <label className={`form-field ${password.length > 0 && !passwordIsValid ? 'has-error' : ''}`}>
                  <span className="field-label">Password</span>
                  <input
                    className={`text-input ${password.length > 0 && !passwordIsValid ? 'input-error' : ''}`}
                    type="password"
                    value={password}
                    placeholder="Create a strong password"
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={password.length > 0 && !passwordIsValid}
                    aria-describedby="password-requirements"
                    autoComplete="new-password"
                  />
                  <div id="password-requirements" className="password-requirements">
                    <span className={`requirement ${passwordValidation.hasMinLength ? 'valid' : ''}`}>
                      ✓ At least 8 characters
                    </span>
                    <span className={`requirement ${passwordValidation.hasUppercase ? 'valid' : ''}`}>
                      ✓ One uppercase letter
                    </span>
                    <span className={`requirement ${passwordValidation.hasLowercase ? 'valid' : ''}`}>
                      ✓ One lowercase letter
                    </span>
                    <span className={`requirement ${passwordValidation.hasNumber ? 'valid' : ''}`}>
                      ✓ One number
                    </span>
                    <span className={`requirement ${passwordValidation.hasSpecialChar ? 'valid' : ''}`}>
                      ✓ One special character
                    </span>
                  </div>
                </label>

                <label className={`form-field ${confirmPassword.length > 0 && !passwordsMatch ? 'has-error' : ''}`}>
                  <span className="field-label">Confirm Password</span>
                  <input
                    className={`text-input ${confirmPassword.length > 0 && !passwordsMatch ? 'input-error' : ''}`}
                    type="password"
                    value={confirmPassword}
                    placeholder="Confirm your password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    aria-describedby={confirmPassword.length > 0 && !passwordsMatch ? "confirm-error" : "confirm-hint"}
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch ? (
                    <span id="confirm-error" className="field-error" role="alert">
                      Passwords do not match.
                    </span>
                  ) : (
                    <span id="confirm-hint" className="field-hint">
                      Re-enter your password.
                    </span>
                  )}
                </label>

                <div className="form-field form-field-full">
                  <span className="field-label">Cuisine Preferences (Optional)</span>
                  <div className="checkbox-group">
                    {cuisineOptions.map((cuisine) => (
                      <label
                        key={cuisine}
                        className={`checkbox-option ${cuisinePreferences.includes(cuisine) ? "is-active" : ""}`}
                      >
                        <input
                          className="checkbox-input"
                          type="checkbox"
                          checked={cuisinePreferences.includes(cuisine)}
                          onChange={() => handleCuisineToggle(cuisine)}
                        />
                        <span className="checkbox-indicator" />
                        {cuisine}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Select cuisines you enjoy cooking or eating.</span>
                </div>

                <div className="form-field form-field-full">
                  <span className="field-label">Dietary Restrictions (Optional)</span>
                  <div className="radio-group">
                    {dietaryOptions.map((option) => (
                      <label
                        key={option}
                        className={`radio-option ${dietaryRestrictions === option ? "is-active" : ""}`}
                      >
                        <input
                          className="radio-input"
                          type="radio"
                          name="dietary"
                          value={option}
                          checked={dietaryRestrictions === option}
                          onChange={(e) => setDietaryRestrictions(e.target.value)}
                        />
                        <span className="radio-dot" />
                        {option}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Help us recommend recipes that fit your diet.</span>
                </div>
              </div>

              <div className="form-footer">
                <div className="footer-actions">
                  <Link to="/" className="ghost-button">Cancel</Link>
                  <button type="submit" className="primary-button" disabled={!canSubmit}>
                    Create Account
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

export default CreateAccount
