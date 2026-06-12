'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Checkbox } from 'primereact/checkbox'
import { cuisineOptions, dietaryOptions } from '@/constants/userPreferences'
import './welcome.scss'

export default function Welcome() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCuisine(value: string) {
    setCuisinePreferences(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  function toggleDietary(value: string) {
    setDietaryRestrictions(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
    )
  }

  async function submit(preferences: { cuisinePreferences: string[]; dietaryRestrictions: string[] }) {
    if (!session?.user?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${session.user.id}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...preferences, marketingEmailOptIn }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Something went wrong. Please try again.')
        return
      }
      await update({ needsOnboarding: false })
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-content">
        <header className="welcome-header">
          <p className="welcome-label">Welcome to Forkful</p>
          <h2 className="welcome-title">Let's personalise your experience</h2>
          <p className="welcome-helper">
            Tell us a bit about your tastes. You can change these anytime in your profile.
          </p>
        </header>

        <section className="welcome-panel">
          <div className="welcome-section">
            <h3 className="section-title">Cuisine Preferences</h3>
            <p className="section-hint">Select the cuisines you enjoy cooking or eating.</p>
            <div className="checkbox-grid">
              {cuisineOptions.map(cuisine => (
                <label
                  key={cuisine}
                  className={`checkbox-option ${cuisinePreferences.includes(cuisine) ? 'is-active' : ''}`}
                >
                  <Checkbox
                    inputId={`cuisine-${cuisine}`}
                    checked={cuisinePreferences.includes(cuisine)}
                    onChange={() => toggleCuisine(cuisine)}
                  />
                  {cuisine}
                </label>
              ))}
            </div>
          </div>

          <div className="welcome-section">
            <h3 className="section-title">Dietary Restrictions</h3>
            <p className="section-hint">Select any dietary restrictions that apply to you.</p>
            <div className="checkbox-grid">
              {dietaryOptions.map(option => (
                <label
                  key={option}
                  className={`checkbox-option ${dietaryRestrictions.includes(option) ? 'is-active' : ''}`}
                >
                  <Checkbox
                    inputId={`dietary-${option}`}
                    checked={dietaryRestrictions.includes(option)}
                    onChange={() => toggleDietary(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="welcome-section">
            <label className="checkbox-option">
              <Checkbox
                inputId="marketing-opt-in"
                checked={marketingEmailOptIn}
                onChange={e => setMarketingEmailOptIn(!!e.checked)}
              />
              Send me news and updates about Forkful (optional)
            </label>
          </div>

          <div className="welcome-footer">
            {error && <p className="welcome-error" role="alert">{error}</p>}
            <button
              type="button"
              className="skip-button"
              onClick={() => submit({ cuisinePreferences: [], dietaryRestrictions: [] })}
              disabled={loading}
            >
              Skip for now
            </button>
            <button
              type="button"
              className="save-button"
              onClick={() => submit({ cuisinePreferences, dietaryRestrictions })}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save & continue'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
