'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { InputText } from 'primereact/inputtext'
import Modal from '@/components/Modal/Modal'
import { Password } from 'primereact/password'
import { Dropdown } from 'primereact/dropdown'
import { cuisineOptions, dietaryOptions } from '@/constants/userPreferences'
import {
  apiUpdatePreferences,
  apiUpdateEmail,
  apiUpdatePassword,
  apiUploadAvatar,
  apiUpdateUsername,
  apiUpdateEmailPreferences,
  apiDeactivateAccount,
  apiDeleteAccount,
  apiSubmitAccountFeedback,
} from '@/lib/api/users'
import type { User, RecipeSuggestionFrequency, PantryExpirationFrequency } from '@/types/User'
import './profile.scss'

const commonPasswords = [
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin', 'login',
  'monkey', 'dragon', 'master', 'football', 'baseball', 'iloveyou', 'trustno1',
  'sunshine', 'princess', 'starwars', 'superman', 'batman', 'shadow', 'michael',
  'jennifer', 'jessica', 'ashley', 'amanda', 'andrew', 'joshua', 'matthew',
  'daniel', 'david', 'james', 'robert', 'john', 'joseph', 'thomas', 'charles',
]

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/

const CLOSURE_REASONS = [
  'Not using it enough',
  'Missing features',
  'Privacy concerns',
  'Switching to another app',
  'Other',
]

const RECIPE_FREQUENCY_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

const PANTRY_FREQUENCY_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
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

function isPasswordValid(v: PasswordValidation): boolean {
  return v.hasMinLength && v.hasUppercase && v.hasLowercase && v.hasNumber && v.hasSpecialChar && v.isNotCommon
}

interface ProfileProps {
  user: User
}

type ClosureModalState = null | 'deactivate' | 'delete'

export default function Profile({ user }: ProfileProps) {
  const router = useRouter()
  const { update: updateSession } = useSession()

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user.avatarUrl)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const { url } = await apiUploadAvatar(user.id!, file)
      setAvatarUrl(url)
      router.refresh()
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Username
  const [username, setUsername] = useState(user.username)
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const isValidUsername = useMemo(() => USERNAME_REGEX.test(username), [username])
  const usernameChanged = username !== user.username

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidUsername || !usernameChanged) return
    setUsernameSaving(true)
    setUsernameError(null)
    setUsernameSuccess(false)
    try {
      await apiUpdateUsername(user.id!, username)
      await updateSession({ username })
      setUsernameSuccess(true)
      router.refresh()
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setUsernameSaving(false)
    }
  }

  // Preferences
  const [cuisine, setCuisine] = useState<string[]>(user.cuisinePreferences ?? [])
  const [dietary, setDietary] = useState<string[]>(user.dietaryRestrictions ?? [])
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefError, setPrefError] = useState<string | null>(null)
  const [prefSuccess, setPrefSuccess] = useState(false)

  function toggleCuisine(option: string) {
    setCuisine(prev => prev.includes(option) ? prev.filter(c => c !== option) : [...prev, option])
    setPrefSuccess(false)
  }

  function toggleDietary(option: string) {
    setDietary(prev => prev.includes(option) ? prev.filter(d => d !== option) : [...prev, option])
    setPrefSuccess(false)
  }

  async function savePreferences() {
    setPrefSaving(true)
    setPrefError(null)
    setPrefSuccess(false)
    try {
      await apiUpdatePreferences(user.id!, cuisine, dietary)
      setPrefSuccess(true)
    } catch (e) {
      setPrefError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setPrefSaving(false)
    }
  }

  // Email preferences
  const [marketingOptIn, setMarketingOptIn] = useState(user.marketingEmailOptIn)
  const [recipeFreq, setRecipeFreq] = useState<RecipeSuggestionFrequency>(user.recipeSuggestionFrequency)
  const [pantryFreq, setPantryFreq] = useState<PantryExpirationFrequency>(user.pantryExpirationFrequency)
  const [emailPrefSaving, setEmailPrefSaving] = useState(false)
  const [emailPrefError, setEmailPrefError] = useState<string | null>(null)
  const [emailPrefSuccess, setEmailPrefSuccess] = useState(false)

  async function saveEmailPreferences() {
    setEmailPrefSaving(true)
    setEmailPrefError(null)
    setEmailPrefSuccess(false)
    try {
      await apiUpdateEmailPreferences(user.id!, {
        marketingEmailOptIn: marketingOptIn,
        recipeSuggestionFrequency: recipeFreq,
        pantryExpirationFrequency: pantryFreq,
      })
      setEmailPrefSuccess(true)
    } catch (err) {
      setEmailPrefError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEmailPrefSaving(false)
    }
  }

  // Account (email + password)
  const [email, setEmail] = useState(user.email)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const isValidEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email])
  const newPasswordValidation = useMemo(() => validatePassword(newPassword), [newPassword])
  const newPasswordIsValid = useMemo(() => isPasswordValid(newPasswordValidation), [newPasswordValidation])
  const passwordsMatch = useMemo(() => newPassword === confirmPassword && confirmPassword.length > 0, [newPassword, confirmPassword])

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailSaving(true)
    setEmailError(null)
    setEmailSuccess(false)
    try {
      await apiUpdateEmail(user.id!, email)
      setEmailSuccess(true)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEmailSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordsMatch || !newPasswordIsValid) return
    setPwSaving(true)
    setPwError(null)
    setPwSuccess(false)
    try {
      await apiUpdatePassword(user.id!, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess(true)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setPwSaving(false)
    }
  }

  // Account closure modal
  const [closureModal, setClosureModal] = useState<ClosureModalState>(null)
  const [closureReasons, setClosureReasons] = useState<string[]>([])
  const [closureComment, setClosureComment] = useState('')
  const [closureSubmitting, setClosureSubmitting] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)

  function openClosureModal(type: 'deactivate' | 'delete') {
    setClosureReasons([])
    setClosureComment('')
    setClosureError(null)
    setClosureModal(type)
  }

  function toggleReason(reason: string) {
    setClosureReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    )
  }

  async function confirmClosure() {
    if (!closureModal) return
    setClosureSubmitting(true)
    setClosureError(null)
    try {
      const action = closureModal === 'deactivate' ? 'deactivated' : 'deleted'
      await apiSubmitAccountFeedback(user.id!, {
        action,
        reasons: closureReasons,
        comment: closureComment || undefined,
      })
      if (closureModal === 'deactivate') {
        await apiDeactivateAccount(user.id!)
      } else {
        await apiDeleteAccount(user.id!)
      }
      await signOut({ callbackUrl: '/' })
    } catch (err) {
      setClosureError(err instanceof Error ? err.message : 'Something went wrong')
      setClosureSubmitting(false)
    }
  }

  return (
    <div className="profile">
      <div className="profile-content">
        <header className="profile-header">
          <button
            type="button"
            className={`profile-avatar${avatarUploading ? ' profile-avatar--uploading' : ''}`}
            title="Change avatar"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt={user.username} className="profile-avatar__img" />
              : <span className="profile-avatar__initial">{user.username.charAt(0).toUpperCase()}</span>
            }
            <span className="profile-avatar__overlay" aria-hidden="true">
              {avatarUploading ? '…' : '📷'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="profile-avatar__input"
            onChange={handleAvatarChange}
          />
          <div>
            {avatarError && <span className="field-error" role="alert">{avatarError}</span>}
            <p className="profile-label">Your Profile</p>
            <h2 className="profile-name">{user.username}</h2>
            <p className="profile-email-display">{user.email}</p>
          </div>
        </header>

        {/* Username */}
        <section className="profile-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Username</span>
            </div>
          </div>
          <div className="panel-content">
            <form className="account-form" onSubmit={saveUsername}>
              <label className={`form-field ${username.length > 0 && !isValidUsername ? 'has-error' : ''}`}>
                <span className="field-label">Username</span>
                <InputText
                  value={username}
                  onChange={e => { setUsername(e.target.value); setUsernameSuccess(false) }}
                  autoComplete="username"
                />
                {username.length > 0 && !isValidUsername && (
                  <span className="field-error" role="alert">
                    3–30 characters, letters, numbers, hyphens and underscores only.
                  </span>
                )}
              </label>
              <div className="panel-footer">
                {usernameSuccess && <span className="success-text">Username updated!</span>}
                {usernameError && <span className="field-error" role="alert">{usernameError}</span>}
                <button type="submit" className="primary-button" disabled={usernameSaving || !isValidUsername || !usernameChanged}>
                  {usernameSaving ? 'Saving…' : 'Update Username'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Preferences */}
        <section className="profile-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Preferences</span>
            </div>
          </div>
          <div className="panel-content">
            <div className="pref-group">
              <span className="field-label">Cuisine Preferences</span>
              <div className="checkbox-group">
                {cuisineOptions.map(option => (
                  <label key={option} className={`checkbox-option ${cuisine.includes(option) ? 'is-active' : ''}`} onClick={() => toggleCuisine(option)}>
                    <span className="checkbox-indicator" />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div className="pref-group">
              <span className="field-label">Dietary Restrictions</span>
              <div className="checkbox-group">
                {dietaryOptions.map(option => (
                  <label key={option} className={`checkbox-option ${dietary.includes(option) ? 'is-active' : ''}`} onClick={() => toggleDietary(option)}>
                    <span className="checkbox-indicator" />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div className="panel-footer">
              {prefSuccess && <span className="success-text">Saved!</span>}
              {prefError && <span className="field-error" role="alert">{prefError}</span>}
              <button className="primary-button" onClick={savePreferences} disabled={prefSaving}>
                {prefSaving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </section>

        {/* Email preferences */}
        <section className="profile-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Email Preferences</span>
            </div>
          </div>
          <div className="panel-content">
            <div className="pref-group">
              <label className={`checkbox-option${marketingOptIn ? ' is-active' : ''}`} onClick={() => { setMarketingOptIn(prev => !prev); setEmailPrefSuccess(false) }}>
                <span className="checkbox-indicator" />
                Receive news and marketing emails
              </label>
            </div>
            <div className="pref-group">
              <span className="field-label">Recipe suggestion emails</span>
              <Dropdown
                value={recipeFreq}
                options={RECIPE_FREQUENCY_OPTIONS}
                onChange={e => { setRecipeFreq(e.value); setEmailPrefSuccess(false) }}
                className="pref-dropdown"
              />
            </div>
            <div className="pref-group">
              <span className="field-label">Pantry expiration reminder emails</span>
              <Dropdown
                value={pantryFreq}
                options={PANTRY_FREQUENCY_OPTIONS}
                onChange={e => { setPantryFreq(e.value); setEmailPrefSuccess(false) }}
                className="pref-dropdown"
              />
            </div>
            <div className="panel-footer">
              {emailPrefSuccess && <span className="success-text">Saved!</span>}
              {emailPrefError && <span className="field-error" role="alert">{emailPrefError}</span>}
              <button className="primary-button" onClick={saveEmailPreferences} disabled={emailPrefSaving}>
                {emailPrefSaving ? 'Saving…' : 'Save Email Preferences'}
              </button>
            </div>
          </div>
        </section>

        {/* Account (email + password) */}
        <section className="profile-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Account</span>
            </div>
          </div>
          <div className="panel-content">
            {user.hasPassword ? (
              <>
                <form className="account-form" onSubmit={saveEmail}>
                  <label className={`form-field ${email.length > 0 && !isValidEmail ? 'has-error' : ''}`}>
                    <span className="field-label">Email Address</span>
                    <InputText
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailSuccess(false) }}
                      autoComplete="email"
                    />
                    {email.length > 0 && !isValidEmail && (
                      <span className="field-error" role="alert">Please enter a valid email address.</span>
                    )}
                  </label>
                  <div className="panel-footer">
                    {emailSuccess && <span className="success-text">Email updated!</span>}
                    {emailError && <span className="field-error" role="alert">{emailError}</span>}
                    <button type="submit" className="primary-button" disabled={emailSaving || !isValidEmail}>
                      {emailSaving ? 'Saving…' : 'Update Email'}
                    </button>
                  </div>
                </form>

                <hr className="section-divider" />

                <form className="account-form" onSubmit={savePassword}>
                  <label className="form-field">
                    <span className="field-label">Current Password</span>
                    <Password value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} toggleMask feedback={false} autoComplete="current-password" />
                  </label>
                  <label className="form-field">
                    <span className="field-label">New Password</span>
                    <Password value={newPassword} onChange={e => setNewPassword(e.target.value)} toggleMask feedback autoComplete="new-password" />
                    {newPassword.length > 0 && !newPasswordIsValid && (
                      <ul className="password-requirements" role="alert">
                        {!newPasswordValidation.hasMinLength && <li>At least 8 characters</li>}
                        {!newPasswordValidation.hasUppercase && <li>At least one uppercase letter</li>}
                        {!newPasswordValidation.hasLowercase && <li>At least one lowercase letter</li>}
                        {!newPasswordValidation.hasNumber && <li>At least one number</li>}
                        {!newPasswordValidation.hasSpecialChar && <li>At least one special character</li>}
                        {!newPasswordValidation.isNotCommon && <li>Password is too common</li>}
                      </ul>
                    )}
                  </label>
                  <label className={`form-field ${confirmPassword.length > 0 && !passwordsMatch ? 'has-error' : ''}`}>
                    <span className="field-label">Confirm New Password</span>
                    <Password value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} toggleMask feedback={false} autoComplete="new-password" />
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <span className="field-error" role="alert">Passwords do not match.</span>
                    )}
                  </label>
                  <div className="panel-footer">
                    {pwSuccess && <span className="success-text">Password updated!</span>}
                    {pwError && <span className="field-error" role="alert">{pwError}</span>}
                    <button type="submit" className="primary-button" disabled={pwSaving || !currentPassword || !newPasswordIsValid || !passwordsMatch}>
                      {pwSaving ? 'Saving…' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="oauth-account-note">
                Your account is managed by an identity provider. Email and password changes are not available.
              </p>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="profile-panel profile-panel--danger">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Account Management</span>
            </div>
          </div>
          <div className="panel-content">
            <div className="danger-zone">
              <div className="danger-action">
                <div>
                  <p className="danger-action__title">Deactivate Account</p>
                  <p className="danger-action__desc">Temporarily disable your account. You can reactivate it at any time by logging back in.</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => openClosureModal('deactivate')}>
                  Deactivate
                </button>
              </div>
              <hr className="section-divider" />
              <div className="danger-action">
                <div>
                  <p className="danger-action__title">Delete Account</p>
                  <p className="danger-action__desc">Permanently delete your account and all associated data. Public recipes will be anonymised. This cannot be undone.</p>
                </div>
                <button type="button" className="danger-button" onClick={() => openClosureModal('delete')}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Billing placeholder */}
        <section className="profile-panel profile-panel--muted">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Billing &amp; Payments</span>
            </div>
            <span className="coming-soon-badge">Coming soon</span>
          </div>
          <div className="panel-content billing-placeholder">
            <div className="billing-icon"><i className="pi pi-credit-card" /></div>
            <p className="billing-message">Billing and payment options will be available here.</p>
          </div>
        </section>
      </div>

      {/* Account closure modal */}
      <Modal
        visible={!!closureModal}
        onHide={() => { if (!closureSubmitting) setClosureModal(null) }}
        header={closureModal === 'deactivate' ? 'Deactivate your account?' : 'Delete your account?'}
        style={{ width: '520px', maxWidth: '95vw' }}
        className="closure-modal"
        footer={
          <div className="dialog-footer">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setClosureModal(null)}
              disabled={closureSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={closureModal === 'delete' ? 'danger-button' : 'secondary-button'}
              onClick={confirmClosure}
              disabled={closureSubmitting}
            >
              {closureSubmitting
                ? 'Processing…'
                : closureModal === 'deactivate' ? 'Yes, deactivate my account' : 'Yes, permanently delete my account'}
            </button>
          </div>
        }
      >
        <p className="modal__body">
          {closureModal === 'deactivate'
            ? 'Your account will be disabled. You can reactivate it any time by logging back in.'
            : 'This will permanently delete your account and all your data. Public recipes will be anonymised. This cannot be undone.'}
        </p>

        <div className="modal__section">
          <p className="field-label">Mind telling us why? (optional)</p>
          <div className="checkbox-group">
            {CLOSURE_REASONS.map(reason => (
              <label key={reason} className={`checkbox-option ${closureReasons.includes(reason) ? 'is-active' : ''}`} onClick={() => toggleReason(reason)}>
                <span className="checkbox-indicator" />
                {reason}
              </label>
            ))}
          </div>
        </div>

        <div className="modal__section">
          <label className="form-field">
            <span className="field-label">Additional comments (optional)</span>
            <textarea
              className="modal__textarea"
              value={closureComment}
              onChange={e => setClosureComment(e.target.value)}
              rows={3}
              placeholder="Anything else you'd like us to know…"
            />
          </label>
        </div>

        {closureError && <p className="field-error" role="alert">{closureError}</p>}
      </Modal>
    </div>
  )
}
