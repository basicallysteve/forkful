'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePantryStore } from '@/stores/pantry'
import { useFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import { apiCreatePantryItem, apiUpdatePantryItem } from '@/lib/api/pantry'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { getTodayDateString, formatDateForInput } from '@/utils/dateHelpers'
import { MASS_UNITS, VOLUME_UNITS, CUSTOM_UNITS, canConvert } from '@/utils/unitConversion'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'

interface PantryStoreProps {
  existingItem?: PantryItem
}

export default function PantryStore({ existingItem }: PantryStoreProps) {
  const router = useRouter()
  const foods = useFoodStore((state) => state.foods)
  const addItem = usePantryStore((state) => state.addItem)
  const updateItem = usePantryStore((state) => state.updateItem)
  const calculateItemStatus = usePantryStore((state) => state.calculateItemStatus)

  const [foodName, setFoodName] = useState<string>(existingItem?.food.name || '')
  const [originalSize, setOriginalSize] = useState<number>(existingItem?.originalSize.size || 1)
  const [originalUnit, setOriginalUnit] = useState<string>(existingItem?.originalSize.unit || 'oz')
  const [currentSize, setCurrentSize] = useState<number>(existingItem?.currentSize.size || existingItem?.originalSize.size || 1)
  const [currentUnit, setCurrentUnit] = useState<string>(existingItem?.currentSize.unit || existingItem?.originalSize.unit || 'oz')
  const [expirationDate, setExpirationDate] = useState<string>(
    existingItem?.expirationDate
      ? formatDateForInput(existingItem.expirationDate)
      : ''
  )
  const [saving, setSaving] = useState(false)

  const isEditing = !!existingItem

  const selectedFood = foods.find(f => f.name.toLowerCase() === foodName.toLowerCase())

  async function handleSave() {
    if (!selectedFood) return
    setSaving(true)
    try {
      if (isEditing) {
        const updated = await apiUpdatePantryItem(existingItem.id, {
          originalSizeAmount: originalSize,
          originalSizeUnit: originalUnit,
          currentSizeAmount: currentSize,
          currentSizeUnit: currentUnit,
          expirationDate: expirationDate || null,
        })
        if (updated) updateItem(updated)
      } else {
        const created = await apiCreatePantryItem({
          foodId: selectedFood.id,
          originalSizeAmount: originalSize,
          originalSizeUnit: originalUnit,
          currentSizeAmount: currentSize,
          currentSizeUnit: currentUnit,
          expirationDate: expirationDate || null,
        })
        addItem(created)
      }
      router.push('/pantry')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    router.push('/pantry')
  }

  const hasSelectedFood = !!selectedFood
  const hasValidOriginalSize = originalSize > 0
  const hasValidCurrentSize = currentSize >= 0
  const sizeValid = canConvert(currentUnit, originalUnit)
    ? currentSize <= originalSize
    : true
  const isSaveDisabled = saving || !hasSelectedFood || !hasValidOriginalSize || !hasValidCurrentSize || !sizeValid

  return (
    <div className="pantry-store-page">
      <div className="pantry-titlebar">
        <span className="title">Pantry Item</span>
      </div>

      <div className="pantry-content">
        <h1>{isEditing ? 'Edit Pantry Item' : 'Add Pantry Item'}</h1>

        <div className="form-container">
          <div className="form-section">
            <label htmlFor="food-select">
              Food Item <span className="required">*</span>
            </label>
            <Autocomplete
              value={foodName}
              options={foods}
              getOptionLabel={(food) => food.name}
              renderOptionMeta={(food) => `${food.calories} cal`}
              onChange={setFoodName}
              placeholder="Select a food item"
              inputAriaLabel="Food item"
            />
          </div>

          <div className="form-section">
            <label htmlFor="original-size">
              Original Size <span className="required">*</span>
            </label>
            <div className="size-input-group">
              <InputNumber
                inputId="original-size"
                min={0.01}
                minFractionDigits={0}
                maxFractionDigits={2}
                value={originalSize}
                onValueChange={(e) => setOriginalSize(e.value ?? 1)}
                placeholder="Enter size"
                className="size-number"
              />
              <Dropdown
                inputId="original-unit"
                value={originalUnit}
                onChange={(e) => setOriginalUnit(e.value)}
                className="size-unit"
                ariaLabel="Original size unit"
                options={[
                  ...MASS_UNITS,
                  ...VOLUME_UNITS,
                  ...CUSTOM_UNITS,
                ].map((unit) => ({ label: unit, value: unit }))}
              />
            </div>
            <small>Original size of each item (e.g., 16 oz box)</small>
          </div>

          <div className="form-section">
            <label htmlFor="current-size">
              Current Size <span className="required">*</span>
            </label>
            <div className="size-input-group">
              <InputNumber
                inputId="current-size"
                min={0}
                minFractionDigits={0}
                maxFractionDigits={2}
                value={currentSize}
                onValueChange={(e) => setCurrentSize(e.value ?? 0)}
                placeholder="Enter size"
                className="size-number"
              />
              <Dropdown
                inputId="current-unit"
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.value)}
                className="size-unit"
                ariaLabel="Current size unit"
                options={[
                  ...MASS_UNITS,
                  ...VOLUME_UNITS,
                  ...CUSTOM_UNITS,
                ].map((unit) => ({ label: unit, value: unit }))}
              />
            </div>
            <small>Remaining size of each item (e.g., 8 oz left)</small>
          </div>

          <div className="form-section">
            <label htmlFor="expiration-date">
              Expiration Date
            </label>
            <input
              id="expiration-date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              min={getTodayDateString()}
            />
            {expirationDate && (
              <div className="date-preview">
                Status: <strong>{calculateItemStatus(new Date(expirationDate))}</strong>
              </div>
            )}
            <small>Optional - leave blank if no expiration date</small>
          </div>

          <div className="form-actions">
            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="btn btn-primary"
            >
              {isEditing ? 'Update Item' : 'Add Item'}
            </button>
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
