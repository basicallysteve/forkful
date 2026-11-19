'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import { apiCreateFood, apiFetchFoods } from '@/lib/api/foods'
import SignInRequiredMessage from '@/components/SignInRequiredMessage/SignInRequiredMessage'
import { isUnauthorizedError, describeSaveFailure } from '@/lib/api/errors'
import type { Food } from '@/types/Food'
import './quick-add-food-modal.scss'

export interface QuickAddFoodModalProps {
  /** Pre-fills the Name field (usually the text the user searched for). */
  initialName: string
  /** Fired with the created Food; the parent closes the modal. */
  onCreated: (food: Food) => void
  /** Fired instead of `onCreated` when a Food with the same name (case-insensitive) already exists. */
  onExisting?: (food: Food) => void
  onHide: () => void
}

/** A Food whose name equals `name` ignoring case and surrounding spaces, or undefined (also when the lookup fails). */
async function findExistingFood(name: string): Promise<Food | undefined> {
  const wanted = name.trim().toLowerCase()
  try {
    const matches = await apiFetchFoods({ search: name.trim() })
    return matches.find(f => f.name.trim().toLowerCase() === wanted)
  } catch {
    return undefined
  }
}

/** Quick-add Food dialog: name, calories and macros, saved per 100 g. Shared by food search inputs. */
export default function QuickAddFoodModal({ initialName, onCreated, onExisting, onHide }: QuickAddFoodModalProps) {
  const [form, setForm] = useState({ name: initialName, calories: '', protein: '0', carbs: '0', fat: '0' })
  const [saving, setSaving] = useState(false)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNeedsSignIn(false)
    setError(null)
    try {
      const existing = await findExistingFood(form.name)
      if (existing) {
        ;(onExisting ?? onCreated)(existing)
        return
      }
      const created = await apiCreateFood({
        name: form.name,
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        fiber: 0,
        servingSize: 100,
        servingUnit: 'g',
        measurements: [{ unit: 'g' }],
      })
      onCreated(created)
    } catch (err) {
      // Stay open with the typed values so the user can retry
      if (isUnauthorizedError(err)) setNeedsSignIn(true)
      else setError(describeSaveFailure(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible
      onHide={onHide}
      onShow={() => nameRef.current?.focus()}
      header="Add a new food"
      className="quick-add-food-modal"
    >
      <form onSubmit={handleSubmit} className="add-food-form">
        <label className="form-field">
          <span>Name</span>
          <input ref={nameRef} type="text" className="text-input" value={form.name} onChange={set('name')} required />
        </label>
        <label className="form-field">
          <span>Calories</span>
          <input type="number" min="0" className="text-input" value={form.calories} onChange={set('calories')} required />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Protein (g)</span>
            <input type="number" min="0" step="0.1" className="text-input" value={form.protein} onChange={set('protein')} />
          </label>
          <label className="form-field">
            <span>Carbs (g)</span>
            <input type="number" min="0" step="0.1" className="text-input" value={form.carbs} onChange={set('carbs')} />
          </label>
          <label className="form-field">
            <span>Fat (g)</span>
            <input type="number" min="0" step="0.1" className="text-input" value={form.fat} onChange={set('fat')} />
          </label>
        </div>
        {error && <p className="add-food-error" role="alert">{error}</p>}
        {needsSignIn && <p className="add-food-error" role="alert"><SignInRequiredMessage /></p>}
        <p className="add-food-note">Nutrition is per 100 g serving. You can edit more details later.</p>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onHide}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Add food'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
