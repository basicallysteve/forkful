'use client'

import { useState, useMemo, useRef } from 'react'
import { Checkbox } from 'primereact/checkbox'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { cuisineOptions, dietaryOptions } from '@/constants/userPreferences'
import { apiUpdatePreferences, apiUpdateEmail, apiUpdatePassword, apiUploadAvatar } from '@/lib/api/users'
import type { User } from '@/types/User'
import './profile.scss'

interface ProfileProps {
  user: User
}

export default function Profile({ user }: ProfileProps) {
  // Avatar section
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
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Preferences section
  const [cuisine, setCuisine] = useState<string[]>(user.cuisinePreferences ?? [])
  const [dietary, setDietary] = useState<string[]>(user.dietaryRestrictions ?? [])
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefError, setPrefError] = useState<string | null>(null)
  const [prefSuccess, setPrefSuccess] = useState(false)

  // Account section
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
  const passwordsMatch = useMemo(() => newPassword === confirmPassword && confirmPassword.length > 0, [newPassword, confirmPassword])

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
    if (!passwordsMatch) return
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
                  <label key={option} className={`checkbox-option ${cuisine.includes(option) ? 'is-active' : ''}`}>
                    <Checkbox className="checkbox-input" checked={cuisine.includes(option)} onChange={() => toggleCuisine(option)} />
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
                  <label key={option} className={`checkbox-option ${dietary.includes(option) ? 'is-active' : ''}`}>
                    <Checkbox className="checkbox-input" checked={dietary.includes(option)} onChange={() => toggleDietary(option)} />
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

        {/* Account */}
        <section className="profile-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Account</span>
            </div>
          </div>
          <div className="panel-content">
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
                <button type="submit" className="primary-button" disabled={pwSaving || !currentPassword || !passwordsMatch}>
                  {pwSaving ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
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
            <div className="billing-icon">💳</div>
            <p className="billing-message">Billing and payment options will be available here.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
