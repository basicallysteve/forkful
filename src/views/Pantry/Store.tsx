'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePantryStore } from '@/stores/pantry'
import { useFoodStore } from '@/stores/food'
import { apiFetchFoods } from '@/lib/api/foods'
import { apiCreatePantryItem, apiUpdatePantryItem } from '@/lib/api/pantry'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import { getTodayDateString, formatDateForInput } from '@/utils/dateHelpers'
import { canConvert, getAllowedUnits, MASS_UNITS, VOLUME_UNITS, CUSTOM_UNITS } from '@/utils/unitConversion'
import QuantityInput from '@/components/QuantityInput/QuantityInput'
import { Dropdown } from 'primereact/dropdown'
import { SelectButton } from 'primereact/selectbutton'

interface PantryStoreProps {
  existingItem?: PantryItem
}

type SourceMode = 'food' | 'product'

// Clicking a size heading focuses that box's amount input, as the old <label htmlFor> did.
function focusSizeInput(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest('.form-section')?.querySelector('input')?.focus()
}

export default function PantryStore({ existingItem }: PantryStoreProps) {
  const router = useRouter()
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)
  const addItem = usePantryStore((state) => state.addItem)
  const updateItem = usePantryStore((state) => state.updateItem)
  const calculateItemStatus = usePantryStore((state) => state.calculateItemStatus)

  // Determine initial source mode from existing item
  const initialSourceMode: SourceMode = existingItem?.sourceType === 'product' ? 'product' : 'food'

  const [sourceMode, setSourceMode] = useState<SourceMode>(initialSourceMode)
  const [selectedFood, setSelectedFood] = useState<Food | null>(existingItem?.food ?? null)
  const [foodName, setFoodName] = useState<string>(existingItem?.food?.name || '')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(existingItem?.product ?? null)
  const [productSearchValue, setProductSearchValue] = useState<string>(existingItem?.product?.name || '')
  const [originalSize, setOriginalSize] = useState<number | null>(existingItem?.originalSize.size || 1)
  const [originalUnit, setOriginalUnit] = useState<string>(existingItem?.originalSize.unit || 'oz')
  const [currentSize, setCurrentSize] = useState<number | null>(existingItem?.currentSize.size || existingItem?.originalSize.size || 1)
  const [currentUnit, setCurrentUnit] = useState<string>(existingItem?.currentSize.unit || existingItem?.originalSize.unit || 'oz')
  const [expirationDate, setExpirationDate] = useState<string>(
    existingItem?.expirationDate
      ? formatDateForInput(existingItem.expirationDate)
      : ''
  )
  // The Current Size box keeps its own text, so remount it when Original Size pushes a new value into it.
  const [currentSizeKey, setCurrentSizeKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isEditing = !!existingItem

  useEffect(() => {
    apiFetchFoods().then(setFoods)
  }, [setFoods])

  // Measurements come from the selected food or product.
  // When density is set, cross-category standard units are appended at runtime.
  const unitOptions = useMemo(() => {
    const source = sourceMode === 'food' ? selectedFood : selectedProduct
    if (!source) {
      return [...MASS_UNITS, ...VOLUME_UNITS, ...CUSTOM_UNITS].map((u) => ({ label: u, value: u }))
    }
    const stored = source.measurements.map(m => m.unit)
    const crossCategory = getAllowedUnits(source.servingUnit, source.density)
      .filter(u => !stored.includes(u))
    const all = [...stored, ...crossCategory]
    return all.map(u => ({ label: u, value: u }))
  }, [selectedFood, selectedProduct, sourceMode])

  function handleFoodSelected(food: Food) {
    setSelectedFood(food)
    setFoodName(food.name)
    if (food.servingUnit) {
      setOriginalUnit(food.servingUnit)
      setCurrentUnit(food.servingUnit)
    }
  }

  function handleProductSelected(product: Product) {
    setSelectedProduct(product)
    setProductSearchValue(product.name)
    // Default units to product's serving unit
    if (product.servingUnit) {
      setOriginalUnit(product.servingUnit)
      setCurrentUnit(product.servingUnit)
    }
  }

  async function handleSave() {
    const hasFood = sourceMode === 'food' && selectedFood
    const hasProduct = sourceMode === 'product' && selectedProduct
    if (!hasFood && !hasProduct) return

    setSaving(true)
    setSaveError(null)
    try {
      if (isEditing) {
        const updated = await apiUpdatePantryItem(existingItem.id, {
          originalSizeAmount: originalSize!,
          originalSizeUnit: originalUnit,
          currentSizeAmount: currentSize!,
          currentSizeUnit: currentUnit,
          expirationDate: expirationDate || null,
        })
        if (updated) updateItem(updated)
      } else {
        const created = await apiCreatePantryItem({
          sourceType: sourceMode,
          foodId: sourceMode === 'food' ? selectedFood!.id : undefined,
          productId: sourceMode === 'product' ? selectedProduct!.id : undefined,
          originalSizeAmount: originalSize!,
          originalSizeUnit: originalUnit,
          currentSizeAmount: currentSize!,
          currentSizeUnit: currentUnit,
          expirationDate: expirationDate || null,
        })
        addItem(created)
      }
      router.push('/pantry')
    } catch {
      setSaveError('Failed to save pantry item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    router.push('/pantry')
  }

  function syncSizes(value: number | null) {
    const currentSizeEqualsOriginal = currentSize === originalSize && currentUnit === originalUnit

    setOriginalSize(value)
    if (currentSizeEqualsOriginal) {
      setCurrentSize(value)
      setCurrentSizeKey((k) => k + 1)
    }
  }

  function syncUnits(unit: string) {
    const currentSizeEqualsOriginal = currentSize === originalSize && currentUnit === originalUnit
    setOriginalUnit(unit)
    if (currentSizeEqualsOriginal) {
      setCurrentUnit(unit)
    }
  }


  const hasValidSelection = sourceMode === 'food' ? !!selectedFood : !!selectedProduct
  const hasValidOriginalSize = originalSize !== null && originalSize > 0
  const hasValidCurrentSize = currentSize !== null && currentSize >= 0
  const activeDensity = (sourceMode === 'food' ? selectedFood : selectedProduct)?.density
  const sizeValid = canConvert(currentUnit, originalUnit, activeDensity) ? currentSize !== null && originalSize !== null && currentSize <= originalSize : true
  const isSaveDisabled = saving || !hasValidSelection || !hasValidOriginalSize || !hasValidCurrentSize || !sizeValid

  return (
    <div className="pantry-store-page">
      <div className="pantry-content">
        <h1>{isEditing ? 'Edit Pantry Item' : 'Add Pantry Item'}</h1>

        <div className="form-container">
          {/* Source mode toggle (only shown when creating) */}
          {!isEditing && (
            <div className="form-section">
              <label>Item type</label>
              <SelectButton
                value={sourceMode}
                onChange={(e) => {
                  const next = e.value as SourceMode
                  if (!next) return
                  setSourceMode(next)
                  if (next === 'food') { setSelectedProduct(null); setProductSearchValue('') }
                  if (next === 'product') { setFoodName('') }
                }}
                options={[
                  { label: 'Generic food', value: 'food' },
                  { label: 'Specific product', value: 'product' },
                ]}
                optionLabel="label"
                optionValue="value"
              />
              <small>
                {sourceMode === 'food'
                  ? 'Track a generic item like "Banana" or "Chicken Breast"'
                  : 'Track a branded product — search by name or scan a barcode'}
              </small>
            </div>
          )}

          <div className="form-section">
            <label htmlFor="food-select">
              {sourceMode === 'food' ? 'Food Item' : 'Product'} <span className="required">*</span>
            </label>
            {sourceMode === 'food' ? (
              <FoodSearch
                value={foodName}
                localFoods={foods}
                onChange={handleFoodSelected}
                placeholder="Select a food item"
                inputAriaLabel="Food item"
              />
            ) : (
              <ProductSearch
                value={productSearchValue}
                onChange={handleProductSelected}
                placeholder="Search or scan a product"
                inputAriaLabel="Product"
              />
            )}
          </div>

          <div className="form-section" role="group" aria-labelledby="original-size-heading">
            <span className="field-heading">
              <span id="original-size-heading" onClick={focusSizeInput}>Original Size</span>{' '}
              <span className="required" aria-hidden="true">*</span>
            </span>
            <div className="size-input-group">
              <label className="size-number">
                <span className="sr-only">Original Size *</span>
                <QuantityInput value={originalSize} unit={originalUnit} onChange={syncSizes} />
              </label>
              <Dropdown
                inputId="original-unit"
                value={originalUnit}
                onChange={(e) => syncUnits(e.value)}
                className="size-unit"
                ariaLabel="Original size unit"
                options={unitOptions}
              />
            </div>
            <small>Original size of each item (e.g., 16 oz box)</small>
          </div>

          <div className="form-section" role="group" aria-labelledby="current-size-heading">
            <span className="field-heading">
              <span id="current-size-heading" onClick={focusSizeInput}>Current Size</span>{' '}
              <span className="required" aria-hidden="true">*</span>
            </span>
            <div className="size-input-group">
              <label className="size-number">
                <span className="sr-only">Current Size *</span>
                <QuantityInput key={currentSizeKey} value={currentSize} unit={currentUnit} onChange={setCurrentSize} />
              </label>
              <Dropdown
                inputId="current-unit"
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.value)}
                className="size-unit"
                ariaLabel="Current size unit"
                options={unitOptions}
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

          {saveError && <p className="form-error">{saveError}</p>}

          <div className="form-actions">
            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
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
