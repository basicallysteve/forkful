'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import { apiCreateFood } from '@/lib/api/foods'
import { isUnauthorizedError, SIGN_IN_REQUIRED_MESSAGE } from '@/lib/api/errors'
import type { Food } from '@/types/Food'
import './quick-add-food-modal.scss'

export interface QuickAddFoodModalProps {
  /** Pre-fills the Name field (usually the text the user searched for). */
  initialName: string
  /** Fired with the created Food; the parent closes the modal. */
  onCreated: (food: Food) => void
  onHide: () => void
}

/** Quick-add Food dialog: name, calories and macros, saved per 100 g. Shared by food search inputs. */
export default function QuickAddFoodModal({ initialName, onCreated, onHide }: QuickAddFoodModalProps) {
  const [form, setForm] = useState({ name: initialName, calories: '', protein: '0', carbs: '0', fat: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
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
      // User can retry
      if (isUnauthorizedError(err)) setError(SIGN_IN_REQUIRED_MESSAGE)
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
