import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantryStore } from '@/stores/pantry'
import { useFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
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
  const [expirationDate, setExpirationDate] = useState<string>(
    existingItem?.expirationDate 
      ? new Date(existingItem.expirationDate).toISOString().split('T')[0]
      : ''
  )

  const isEditing = !!existingItem

  // Derive selected food from foodName
  const selectedFood = foods.find(f => f.name.toLowerCase() === foodName.toLowerCase())

  // Generate a new ID for pantry items
  function generateId(): number {
    if (items.length === 0) return 1
    return Math.max(...items.map((item) => item.id)) + 1
  }

  function handleSave() {
    if (!selectedFood || !expirationDate) return

    const pantryItem: PantryItem = {
      id: isEditing ? existingItem.id : generateId(),
      food: selectedFood,
      quantity,
      expirationDate: new Date(expirationDate),
      addedDate: isEditing ? existingItem.addedDate : new Date(),
      status: calculateItemStatus(new Date(expirationDate)),
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

  const isSaveDisabled = !selectedFood || !expirationDate || quantity <= 0

  return (
    <div className="pantry-store-page">
      <div className="page-header">
        <h1>{isEditing ? 'Edit Pantry Item' : 'Add Pantry Item'}</h1>
      </div>

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
        </div>

        <div className="form-section">
          <label htmlFor="expiration-date">
            Expiration Date <span className="required">*</span>
          </label>
          <input
            id="expiration-date"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          {expirationDate && (
            <div className="date-preview">
              Status: <strong>{calculateItemStatus(new Date(expirationDate))}</strong>
            </div>
          )}
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
  )
}
