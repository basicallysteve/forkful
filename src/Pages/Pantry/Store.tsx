import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantryStore } from '@/stores/pantry'
import { useFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { getTodayDateString, formatDateForInput } from '@/utils/dateHelpers'
import { MASS_UNITS, VOLUME_UNITS, CUSTOM_UNITS, canConvert } from '@/utils/unitConversion'
import './pantry.scss'

interface PantryStoreProps {
  existingItem?: PantryItem
}

export default function PantryStore({ existingItem }: PantryStoreProps) {
  const navigate = useNavigate()
  const foods = useFoodStore((state) => state.foods)
  const addItem = usePantryStore((state) => state.addItem)
  const updateItem = usePantryStore((state) => state.updateItem)
  const items = usePantryStore((state) => state.items)
  const calculateItemStatus = usePantryStore((state) => state.calculateItemStatus)

  const [foodName, setFoodName] = useState<string>(existingItem?.food.name || '')
  const [quantity, setQuantity] = useState<number>(existingItem?.quantity || 1)
  const [quantityLeft, setQuantityLeft] = useState<number>(existingItem?.quantityLeft || existingItem?.quantity || 1)
  const [originalSize, setOriginalSize] = useState<number>(existingItem?.originalSize.size || 1)
  const [originalUnit, setOriginalUnit] = useState<string>(existingItem?.originalSize.unit || 'oz')
  const [currentSize, setCurrentSize] = useState<number>(existingItem?.currentSize.size || existingItem?.originalSize.size || 1)
  const [currentUnit, setCurrentUnit] = useState<string>(existingItem?.currentSize.unit || existingItem?.originalSize.unit || 'oz')
  const [expirationDate, setExpirationDate] = useState<string>(
    existingItem?.expirationDate 
      ? formatDateForInput(existingItem.expirationDate)
      : ''
  )

  const isEditing = !!existingItem

  // Derive selected food from foodName
  const selectedFood = foods.find(f => f.name.toLowerCase() === foodName.toLowerCase())

  // Handle unit changes to keep units compatible
  function handleOriginalUnitChange(newUnit: string) {
    setOriginalUnit(newUnit)
  }

  function handleCurrentUnitChange(newUnit: string) {
    setCurrentUnit(newUnit)
  }

  // Generate a new ID for pantry items
  function generateId(): number {
    if (items.length === 0) return 1
    return Math.max(...items.map((item) => item.id)) + 1
  }

  function handleSave() {
    if (!selectedFood) return

    const pantryItem: PantryItem = {
      id: isEditing ? existingItem.id : generateId(),
      food: selectedFood,
      quantity,
      quantityLeft,
      originalSize: { size: originalSize, unit: originalUnit },
      currentSize: { size: currentSize, unit: currentUnit },
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      addedDate: isEditing ? existingItem.addedDate : new Date(),
      status: calculateItemStatus(expirationDate ? new Date(expirationDate) : null),
      frozenDate: isEditing ? existingItem.frozenDate : null,
    }

    if (isEditing) {
      updateItem(pantryItem)
    } else {
      addItem(pantryItem)
    }

    navigate('/pantry')
  }

  function handleCancel() {
    navigate('/pantry')
  }

  // Validation logic
  const hasSelectedFood = !!selectedFood
  const hasValidQuantity = quantity > 0
  const quantityLeftValid = quantityLeft <= quantity
  // Validate size based on unit compatibility
  const sizeValid = canConvert(currentUnit, originalUnit) 
    ? currentSize <= originalSize 
    : true // If units aren't convertible, skip size validation
  const isSaveDisabled = !hasSelectedFood || !hasValidQuantity || !quantityLeftValid || !sizeValid

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
          <label htmlFor="quantity">
            Quantity <span className="required">*</span>
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Enter quantity"
          />
          <small>Number of items purchased</small>
        </div>

        <div className="form-section">
          <label htmlFor="quantity-left">
            Quantity Left <span className="required">*</span>
          </label>
          <input
            id="quantity-left"
            type="number"
            min="0"
            max={quantity}
            step="1"
            value={quantityLeft}
            onChange={(e) => setQuantityLeft(Number(e.target.value))}
            placeholder="Enter quantity left"
          />
          <small>Number of items remaining</small>
        </div>

        <div className="form-section">
          <label htmlFor="original-size">
            Original Size <span className="required">*</span>
          </label>
          <div className="size-input-group">
            <input
              id="original-size"
              type="number"
              min="0.01"
              step="0.01"
              value={originalSize}
              onChange={(e) => setOriginalSize(Number(e.target.value))}
              placeholder="Enter size"
              className="size-number"
            />
            <select
              id="original-unit"
              value={originalUnit}
              onChange={(e) => handleOriginalUnitChange(e.target.value)}
              className="size-unit"
              aria-label="Original size unit"
            >
              <optgroup label="Mass">
                {MASS_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volume">
                {VOLUME_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Custom">
                {CUSTOM_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <small>Original size of each item (e.g., 16 oz box)</small>
        </div>

        <div className="form-section">
          <label htmlFor="current-size">
            Current Size <span className="required">*</span>
          </label>
          <div className="size-input-group">
            <input
              id="current-size"
              type="number"
              min="0"
              max={canConvert(currentUnit, originalUnit) ? originalSize : undefined}
              step="0.01"
              value={currentSize}
              onChange={(e) => setCurrentSize(Number(e.target.value))}
              placeholder="Enter size"
              className="size-number"
            />
            <select
              id="current-unit"
              value={currentUnit}
              onChange={(e) => handleCurrentUnitChange(e.target.value)}
              className="size-unit"
              aria-label="Current size unit"
            >
              <optgroup label="Mass">
                {MASS_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volume">
                {VOLUME_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Custom">
                {CUSTOM_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </optgroup>
            </select>
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
