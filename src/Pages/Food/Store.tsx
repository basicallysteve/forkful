import { useState, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import type { Food } from '@/types/Food'
import './store.scss'

const defaultMeasurements = ['g', 'oz', 'cup', 'tbsp', 'tsp', 'slice', 'piece']

interface FoodStoreProps {
  existingFood?: Food
}

function Store({ existingFood }: FoodStoreProps) {
  const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext)
  const navigate = useNavigate()

  if (!foodContext) {
    throw new Error('FoodProvider is missing')
  }

  const { foods, addFood, updateFood } = foodContext

  const isEditing = !!existingFood

  const [food, setFood] = useState<Partial<Food>>({
    name: existingFood?.name || '',
    calories: existingFood?.calories || 0,
    protein: existingFood?.protein || 0,
    carbs: existingFood?.carbs || 0,
    fat: existingFood?.fat || 0,
    fiber: existingFood?.fiber || 0,
    servingSize: existingFood?.servingSize || 1,
    servingUnit: existingFood?.servingUnit || 'g',
    measurements: existingFood?.measurements || ['g'],
  })

  const [newMeasurement, setNewMeasurement] = useState('')

  // Check for duplicate food name (case-insensitive, trimmed)
  const isDuplicateName = useMemo(() => {
    const trimmedName = food.name?.trim().toLowerCase()
    if (!trimmedName) return false
    // When editing, exclude the current food from the duplicate check
    if (isEditing && existingFood) {
      return foods.some(f => f.id !== existingFood.id && f.name.trim().toLowerCase() === trimmedName)
    }
    return foods.some(f => f.name.trim().toLowerCase() === trimmedName)
  }, [food.name, foods, isEditing, existingFood])

  const canSave = useMemo(() => {
    return !!(
      food.name?.trim() &&
      food.calories !== undefined &&
      food.calories >= 0 &&
      food.servingSize &&
      food.servingSize > 0 &&
      !isDuplicateName
    )
  }, [food, isDuplicateName])

  function handleMacroChange(field: 'protein' | 'carbs' | 'fat' | 'fiber', value: string) {
    const numValue = Number(value)
    const nextValue = value === '' || isNaN(numValue) ? 0 : Math.max(0, numValue)
    setFood({
      ...food,
      [field]: nextValue,
    })
  }

  function handleAddMeasurement() {
    const trimmed = newMeasurement.trim().toLowerCase()
    if (!trimmed) return
    if (food.measurements?.includes(trimmed)) return

    setFood({
      ...food,
      measurements: [...(food.measurements || []), trimmed],
    })
    setNewMeasurement('')
  }

  function handleRemoveMeasurement(measurement: string) {
    setFood({
      ...food,
      measurements: food.measurements?.filter(m => m !== measurement) || [],
    })
  }

  function handleSaveFood() {
    if (!canSave) return

    const foodData: Omit<Food, 'id'> = {
      name: food.name!.trim(),
      calories: food.calories!,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      fiber: food.fiber || 0,
      servingSize: food.servingSize!,
      servingUnit: food.servingUnit,
      measurements: food.measurements,
    }

    if (isEditing && existingFood) {
      updateFood({ ...foodData, id: existingFood.id })
      navigate('/foods')
    } else {
      addFood(foodData)
      navigate('/foods')
    }
  }

  return (
    <div className="food-store">
      <div className="store-titlebar" aria-hidden="true">
        <span className="title">Forkful — {food.name || 'New Food'}</span>
      </div>

      <div className="store-content">
        <header className="store-header">
          <div>
            <p className="store-label">Food Builder</p>
            <h2 className="store-name">{isEditing ? 'Edit Food' : 'Add New Food'}</h2>
            <p className="store-helper">
              Define the nutritional information for this food item.
            </p>
          </div>
          <div className="store-meta">
            <span className="pill pill-primary">{isEditing ? 'Editing' : 'New'}</span>
          </div>
        </header>

        <section className="store-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">Details</span>
            </div>
          </div>

          <div className="panel-content">
            <form className="store-form">
              <div className="form-grid">
                <label className={`form-field ${isDuplicateName ? 'has-error' : ''}`}>
                  <span className="field-label">Name</span>
                  <input
                    className={`text-input ${isDuplicateName ? 'input-error' : ''}`}
                    type="text"
                    value={food.name}
                    placeholder="e.g. Chicken Breast"
                    onChange={(e) => setFood({ ...food, name: e.target.value })}
                    aria-invalid={isDuplicateName}
                    aria-describedby={isDuplicateName ? 'name-error' : undefined}
                  />
                  {isDuplicateName ? (
                    <span id="name-error" className="field-error" role="alert">
                      A food with this name already exists.
                    </span>
                  ) : (
                    <span className="field-hint">Enter a descriptive name for this food.</span>
                  )}
                </label>

                <label className="form-field">
                  <span className="field-label">Calories (per serving)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    value={food.calories}
                    onChange={(e) =>
                      setFood({
                        ...food,
                        calories: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)),
                      })
                    }
                    aria-label="Calories"
                  />
                  <span className="field-hint">Total calories per serving size.</span>
                </label>

                <label className="form-field">
                  <span className="field-label">Serving Size</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.1"
                    value={food.servingSize}
                    onChange={(e) =>
                      setFood({
                        ...food,
                        servingSize:
                          e.target.value === '' ? 1 : Math.max(0.1, Number(e.target.value)),
                      })
                    }
                    aria-label="Serving size"
                  />
                  <span className="field-hint">Amount per serving.</span>
                </label>

                <label className="form-field">
                  <span className="field-label">Serving Unit</span>
                  <select
                    className="text-input"
                    value={food.servingUnit}
                    onChange={(e) => setFood({ ...food, servingUnit: e.target.value })}
                    aria-label="Serving unit"
                  >
                    {defaultMeasurements.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                    {food.measurements
                      ?.filter((m) => !defaultMeasurements.includes(m))
                      .map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                  </select>
                  <span className="field-hint">Unit of measurement.</span>
                </label>

                <div className="form-field form-field-full">
                  <span className="field-label">Macronutrients (grams per serving)</span>
                  <div className="macro-grid">
                    <label className="macro-field">
                      <span className="macro-label">Protein</span>
                      <input
                        className="text-input macro-input"
                        type="number"
                        min={0}
                        step="0.1"
                        value={food.protein || 0}
                        onChange={(e) => handleMacroChange('protein', e.target.value)}
                        aria-label="Protein"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Carbs</span>
                      <input
                        className="text-input macro-input"
                        type="number"
                        min={0}
                        step="0.1"
                        value={food.carbs || 0}
                        onChange={(e) => handleMacroChange('carbs', e.target.value)}
                        aria-label="Carbohydrates"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Fat</span>
                      <input
                        className="text-input macro-input"
                        type="number"
                        min={0}
                        step="0.1"
                        value={food.fat || 0}
                        onChange={(e) => handleMacroChange('fat', e.target.value)}
                        aria-label="Fat"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Fiber</span>
                      <input
                        className="text-input macro-input"
                        type="number"
                        min={0}
                        step="0.1"
                        value={food.fiber || 0}
                        onChange={(e) => handleMacroChange('fiber', e.target.value)}
                        aria-label="Fiber"
                      />
                    </label>
                  </div>
                </div>

                <div className="form-field form-field-full">
                  <span className="field-label">Available Measurements</span>
                  <div className="measurements-list">
                    {food.measurements?.map((measurement) => (
                      <span key={measurement} className="measurement-tag">
                        {measurement}
                        <button
                          type="button"
                          className="measurement-remove"
                          onClick={() => handleRemoveMeasurement(measurement)}
                          aria-label={`Remove ${measurement}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="add-measurement">
                    <input
                      className="text-input measurement-input"
                      type="text"
                      placeholder="Add measurement (e.g. cup, tbsp)"
                      value={newMeasurement}
                      onChange={(e) => setNewMeasurement(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddMeasurement()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={handleAddMeasurement}
                    >
                      Add
                    </button>
                  </div>
                  <span className="field-hint">
                    Define which units can be used when measuring this food.
                  </span>
                </div>
              </div>

              <div className="form-footer">
                <div className="footer-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigate('/foods')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!canSave}
                    onClick={handleSaveFood}
                  >
                    {isEditing ? 'Update Food' : 'Save Food'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Store
