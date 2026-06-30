'use client'

import { useState } from 'react'
import Modal from '@/components/Modal/Modal'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { apiLinkProductToFood } from '@/lib/api/products'
import { useFoodStore } from '@/stores/food'
import { apiFetchFoods } from '@/lib/api/foods'
import type { Product } from '@/types/Product'
import type { Food } from '@/types/Food'

interface LinkFoodModalProps {
  product: Product
  onLinked: (product: Product) => void
  onSkip: (product: Product) => void
  onHide: () => void
}

export default function LinkFoodModal({ product, onLinked, onSkip, onHide }: LinkFoodModalProps) {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)

  const [foodName, setFoodName] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (foods.length === 0) {
    apiFetchFoods().then(setFoods)
  }

  async function handleConfirm() {
    if (!selectedFood || !product.slug) return
    setSaving(true)
    setSaveError(null)
    try {
      await apiLinkProductToFood(product.slug, selectedFood.id)
      onLinked({ ...product, parentFoodId: selectedFood.id })
    } catch {
      setSaveError('Failed to link food. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible
      onHide={onHide}
      header="Confirm food type"
      style={{ width: '420px', maxWidth: '95vw' }}
    >
      <div className="bcm-form">
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          <strong>{product.name}</strong> isn&apos;t linked to a food type yet. Linking it lets this product be suggested when preparing meals.
        </p>

        <div className="form-field">
          <label>
            What type of food is this? <span className="required">*</span>
          </label>
          <small className="bcm-food-hint">Required for meal suggestions</small>
          <FoodSearch
            value={foodName}
            localFoods={foods}
            onChange={(food) => {
              setSelectedFood(food)
              setFoodName(food.name)
            }}
            placeholder="Search foods…"
            inputAriaLabel="Food type"
          />
        </div>

        {saveError && <p className="bcm-save-error">{saveError}</p>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => onSkip(product)}>
            Skip for now
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleConfirm}
            disabled={saving || !selectedFood}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
