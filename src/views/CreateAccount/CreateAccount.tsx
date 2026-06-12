'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { apiSignUp } from "@/lib/api/users"
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { cuisineOptions, dietaryOptions } from '@/constants/userPreferences'
import './createAccount.scss'

// Common passwords that should be rejected
const commonPasswords = [
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "letmein", "welcome", "admin", "login",
  "monkey", "dragon", "master", "football", "baseball", "iloveyou", "trustno1",
  "sunshine", "princess", "starwars", "superman", "batman", "shadow", "michael",
  "jennifer", "jessica", "ashley", "amanda", "andrew", "joshua", "matthew",
  "daniel", "david", "james", "robert", "john", "joseph", "thomas", "charles"
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
  const lowerPassword = password.toLowerCase()
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    isNotCommon: password.length === 0 || !commonPasswords.includes(lowerPassword),
  }
}

function isPasswordValid(validation: PasswordValidation): boolean {
  return (
    validation.hasMinLength &&
    validation.hasUppercase &&
    validation.hasLowercase &&
    validation.hasNumber &&
    validation.hasSpecialChar &&
    validation.isNotCommon
  )
}

function CreateAccount() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      passwordsMatch &&
      !isSubmitting
    )
  }, [username, isValidEmail, passwordIsValid, passwordsMatch, isSubmitting])

  function handleCuisineToggle(cuisine: string) {
    if (cuisinePreferences.includes(cuisine)) {
      setCuisinePreferences(cuisinePreferences.filter((c) => c !== cuisine))
    } else {
      setCuisinePreferences([...cuisinePreferences, cuisine])
    }
  }

  function handleDietaryToggle(option: string) {
    setDietaryRestrictions(prev =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await apiSignUp({
        username,
        email,
        password,
        cuisinePreferences,
        dietaryRestrictions,
        marketingEmailOptIn,
      })
    
      window.location.href = '/login'
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="create-account">
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
                  <InputText
                    type="text"
                    value={username}
                    placeholder="Choose a username"
                    onChange={(e) => setUsername(e.target.value)}
                    aria-describedby="username-hint"
                    autoComplete="username"
                  />
                  <span id="username-hint" className="field-hint">
                    3–30 characters, letters, numbers, hyphens and underscores only.
                  </span>
                </label>

                <label className={`form-field ${email.length > 0 && !isValidEmail ? 'has-error' : ''}`}>
                  <span className="field-label">Email</span>
                  <InputText
                    className={email.length > 0 && !isValidEmail ? 'input-error' : undefined}
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
                  <Password
                    className={`password-input ${password.length > 0 && !passwordIsValid ? 'input-error' : ''}`}
                    value={password}
                    placeholder="Create a strong password"
                    onChange={(e) => setPassword(e.target.value)}
                    toggleMask
                    feedback
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
                    <span className={`requirement ${passwordValidation.isNotCommon ? 'valid' : ''}`}>
                      ✓ Not a common password
                    </span>
                  </div>
                </label>

                <label className={`form-field ${confirmPassword.length > 0 && !passwordsMatch ? 'has-error' : ''}`}>
                  <span className="field-label">Confirm Password</span>
                  <Password
                    className={`password-input ${confirmPassword.length > 0 && !passwordsMatch ? 'input-error' : ''}`}
                    value={confirmPassword}
                    placeholder="Confirm your password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    toggleMask
                    feedback={false}
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    aria-describedby={confirmPassword.length > 0 && !passwordsMatch ? 'confirm-error' : 'confirm-hint'}
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
                        onClick={() => handleCuisineToggle(cuisine)}
                      >
                        <span className="checkbox-indicator" />
                        {cuisine}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Select cuisines you enjoy cooking or eating.</span>
                </div>

                <div className="form-field form-field-full">
                  <span className="field-label">Dietary Restrictions (Optional)</span>
                  <div className="checkbox-group">
                    {dietaryOptions.map((option) => (
                      <label
                        key={option}
                        className={`checkbox-option ${dietaryRestrictions.includes(option) ? "is-active" : ""}`}
                        onClick={() => handleDietaryToggle(option)}
                      >
                        <span className="checkbox-indicator" />
                        {option}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Help us recommend recipes that fit your diet.</span>
                </div>

                <div className="form-field form-field-full">
                  <label
                    className={`checkbox-option${marketingEmailOptIn ? ' is-active' : ''}`}
                    onClick={() => setMarketingEmailOptIn(prev => !prev)}
                  >
                    <span className="checkbox-indicator" />
                    Send me news and updates about Forkful (optional)
                  </label>
                </div>
              </div>

              <div className="form-footer">
                <div className="footer-actions">
                  <Link href="/" className="ghost-button">Cancel</Link>
                  <button type="submit" className="primary-button" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? 'Creating Account…' : 'Create Account'}
                  </button>
                </div>
                {submitError && (
                  <p className="field-error" role="alert">{submitError}</p>
                )}
              </div>
            </form>

            <div className="form-links">
              <p>
                Already have an account? <Link href="/login">Login</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default CreateAccount
