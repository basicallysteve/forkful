import { useState, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import { getUnitCategory, MASS_UNITS, VOLUME_UNITS, CUSTOM_UNITS, type UnitCategory } from '@/utils/unitConversion'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import './store.scss'

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

  // Get the category of the base serving unit
  const servingUnitCategory = useMemo((): UnitCategory => {
    return getUnitCategory(food.servingUnit || 'g')
  }, [food.servingUnit])

  // Get available measurement options based on serving unit category
  const availableMeasurementOptions = useMemo((): string[] => {
    const alreadyAdded = food.measurements || []
    let availableUnits: string[] = []
    
    if (servingUnitCategory === 'mass') {
      // Mass serving unit: show mass units + custom units
      availableUnits = [...MASS_UNITS, ...CUSTOM_UNITS]
    } else if (servingUnitCategory === 'volume') {
      // Volume serving unit: show volume units + custom units
      availableUnits = [...VOLUME_UNITS, ...CUSTOM_UNITS]
    } else {
      // Custom serving unit: show all units
      availableUnits = [...MASS_UNITS, ...VOLUME_UNITS, ...CUSTOM_UNITS]
    }
    
    // Filter out units that are already added
    return availableUnits.filter(unit => !alreadyAdded.includes(unit))
  }, [servingUnitCategory, food.measurements])

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

  function handleAddMeasurement(unitToAdd?: string) {
    const trimmed = (unitToAdd || newMeasurement).trim().toLowerCase()
    if (!trimmed) return
    if (food.measurements?.includes(trimmed)) return
    
    // Check if the new measurement is compatible with the serving unit category
    const newUnitCategory = getUnitCategory(trimmed)
    if (servingUnitCategory !== 'custom' && newUnitCategory !== 'custom' && newUnitCategory !== servingUnitCategory) {
      // Don't allow mixing mass and volume units
      return
    }

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

  function handleServingUnitChange(newUnit: string) {
    const newCategory = getUnitCategory(newUnit)
    const oldCategory = getUnitCategory(food.servingUnit || 'g')
    
    // If category changed, filter out incompatible measurements
    let updatedMeasurements = food.measurements || []
    if (newCategory !== oldCategory && newCategory !== 'custom' && oldCategory !== 'custom') {
      // Filter to only keep compatible measurements
      updatedMeasurements = updatedMeasurements.filter(m => {
        const mCategory = getUnitCategory(m)
        return mCategory === newCategory || mCategory === 'custom'
      })
    }
    
    // Make sure the new unit is in measurements
    if (!updatedMeasurements.includes(newUnit)) {
      updatedMeasurements = [newUnit, ...updatedMeasurements]
    }
    
    setFood({
      ...food,
      servingUnit: newUnit,
      measurements: updatedMeasurements,
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
      navigate(`/foods/${toSlug(food.name!)}`)
    } else {
      addFood(foodData)
      navigate(`/foods/${toSlug(food.name!)}`)
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
                    onChange={(e) => handleServingUnitChange(e.target.value)}
                    aria-label="Serving unit"
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
                    {food.measurements
                      ?.filter((m) => {
                        const allStandardUnits: string[] = [...MASS_UNITS, ...VOLUME_UNITS, ...CUSTOM_UNITS]
                        return !allStandardUnits.includes(m)
                      })
                      .map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                  </select>
                  <span className="field-hint">Unit of measurement. {servingUnitCategory !== 'custom' ? `Changing this will filter measurements to ${servingUnitCategory} units.` : ''}</span>
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
                    <Autocomplete
                      value={newMeasurement}
                      options={availableMeasurementOptions}
                      getOptionLabel={(opt) => opt}
                      onChange={(value) => setNewMeasurement(value)}
                      onSelect={(unit) => handleAddMeasurement(unit)}
                      placeholder="Add measurement (e.g. cup, tbsp)"
                      inputAriaLabel="Add measurement"
                      allowClear={true}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleAddMeasurement()}
                    >
                      Add
                    </button>
                  </div>
                  <span className="field-hint">
                    {servingUnitCategory !== 'custom' 
                      ? `Define which units can be used when measuring this food. Showing ${servingUnitCategory} and custom units.`
                      : 'Define which units can be used when measuring this food.'}
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
