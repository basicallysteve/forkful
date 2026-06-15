'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFoodStore } from '@/stores/food'
import { apiCreateFood, apiUpdateFood } from '@/lib/api/foods'
import type { Food, Measurement } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import { getUnitCategory, convertUnit, getAllowedUnits, MASS_UNITS, VOLUME_UNITS, CUSTOM_UNITS, type UnitCategory } from '@/utils/unitConversion'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'

interface FoodStoreProps {
  existingFood?: Food
}

function Store({ existingFood }: FoodStoreProps) {
  const foods = useFoodStore((state) => state.foods)
  const addFood = useFoodStore((state) => state.addFood)
  const updateFood = useFoodStore((state) => state.updateFood)
  const router = useRouter()

  const isEditing = !!existingFood

  const [food, setFood] = useState<Partial<Food>>({
    name: existingFood?.name || '',
    calories: existingFood?.calories || 0,
    protein: existingFood?.protein || 0,
    carbs: existingFood?.carbs || 0,
    fat: existingFood?.fat || 0,
    fiber: existingFood?.fiber || 0,
    saturatedFat: existingFood?.saturatedFat,
    sugar: existingFood?.sugar,
    sodium: existingFood?.sodium,
    servingSize: existingFood?.servingSize || 1,
    servingUnit: existingFood?.servingUnit || 'g',
    measurements: existingFood?.measurements || [{ unit: 'g' }],
    density: existingFood?.density,
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

  // Get available measurement options based on serving unit category and density
  const availableMeasurementOptions = useMemo((): string[] => {
    const alreadyAdded = (food.measurements || []).map((m) => m.unit)
    const standardUnits = getAllowedUnits(food.servingUnit || 'g', food.density)
    const availableUnits = servingUnitCategory === 'custom'
      ? standardUnits
      : [...standardUnits, ...CUSTOM_UNITS]
    return availableUnits.filter(unit => !alreadyAdded.includes(unit))
  }, [servingUnitCategory, food.measurements, food.servingUnit, food.density])

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

  function handleMacroChange(field: 'protein' | 'carbs' | 'fat' | 'fiber', value: number | null | undefined) {
    setFood({ ...food, [field]: Math.max(0, value ?? 0) })
  }

  function handleOptionalMacroChange(field: 'saturatedFat' | 'sugar' | 'sodium', value: number | null | undefined) {
    setFood({ ...food, [field]: value != null ? Math.max(0, value) : undefined })
  }

  function handleAddMeasurement(unitToAdd?: string) {
    const trimmed = (unitToAdd || newMeasurement).trim().toLowerCase()
    if (!trimmed) return
    if (food.measurements?.some((m) => m.unit === trimmed)) return

    const newUnitCategory = getUnitCategory(trimmed)
    const crossCategory = newUnitCategory !== 'custom' && newUnitCategory !== servingUnitCategory
    if (servingUnitCategory !== 'custom' && crossCategory && !(food.density && food.density > 0)) {
      return
    }

    setFood({
      ...food,
      measurements: [...(food.measurements || []), { unit: trimmed }],
    })
    setNewMeasurement('')
  }

  function handleRemoveMeasurement(unit: string) {
    setFood({
      ...food,
      measurements: (food.measurements || []).filter((m) => m.unit !== unit),
    })
  }

  function handleSetGramsPerUnit(unit: string, grams: number | undefined) {
    setFood({
      ...food,
      measurements: (food.measurements || []).map((m) =>
        m.unit === unit ? { ...m, gramsPerUnit: grams } : m
      ),
    })
  }

  function handleServingUnitChange(newUnit: string) {
    const newCategory = getUnitCategory(newUnit)
    const oldCategory = getUnitCategory(food.servingUnit || 'g')

    let updatedMeasurements: Measurement[] = food.measurements || []

    // Recalculate servingSize when switching within the same standard category
    let newServingSize = food.servingSize
    if (newCategory === oldCategory && newCategory !== 'custom') {
      const converted = convertUnit(food.servingSize || 1, food.servingUnit || 'g', newUnit)
      if (converted !== null) newServingSize = Math.round(converted * 100) / 100
    }

    // Cross-category change: drop incompatible standard-unit measurements
    if (newCategory !== oldCategory && newCategory !== 'custom' && oldCategory !== 'custom') {
      updatedMeasurements = updatedMeasurements.filter((m) => {
        const cat = getUnitCategory(m.unit)
        return cat === newCategory || cat === 'custom'
      })
    }

    if (!updatedMeasurements.some((m) => m.unit === newUnit)) {
      updatedMeasurements = [{ unit: newUnit }, ...updatedMeasurements]
    }

    setFood({
      ...food,
      servingUnit: newUnit,
      servingSize: newServingSize,
      measurements: updatedMeasurements,
    })
  }

  async function handleSaveFood() {
    if (!canSave) return

    const foodData: Omit<Food, 'id'> = {
      name: food.name!.trim(),
      calories: food.calories!,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      fiber: food.fiber || 0,
      saturatedFat: food.saturatedFat,
      sugar: food.sugar,
      sodium: food.sodium,
      servingSize: food.servingSize!,
      servingUnit: food.servingUnit ?? 'g',
      measurements: food.measurements ?? [],
      density: food.density,
    }

    if (isEditing && existingFood) {
      try {
        const updatedFood = await apiUpdateFood({ ...foodData, id: existingFood.id })
        updateFood(updatedFood)
        router.push(`/foods/${toSlug(updatedFood.name)}`)
      } catch (err) {
        console.error('Failed to persist food update:', err)
      }
    } else {
      try {
        const createdFood = await apiCreateFood(foodData)
        addFood(createdFood)
        router.push(`/foods/${toSlug(createdFood.name)}`)
      } catch (err) {
        console.error('Failed to persist new food:', err)
      }
    }
  }

  return (
    <div className="food-store">
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
                  <InputText
                    className={isDuplicateName ? 'input-error' : undefined}
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
                  <InputNumber
                    min={0}
                    value={food.calories ?? 0}
                    onValueChange={(e) =>
                      setFood({
                        ...food,
                        calories: Math.max(0, e.value ?? 0),
                      })
                    }
                    aria-label="Calories"
                  />
                  <span className="field-hint">Total calories per serving size.</span>
                </label>

                <label className="form-field">
                  <span className="field-label">Serving Size</span>
                  <InputNumber
                    min={0}
                    minFractionDigits={0}
                    maxFractionDigits={2}
                    value={food.servingSize ?? 1}
                    onValueChange={(e) =>
                      setFood({
                        ...food,
                        servingSize: Math.max(0.1, e.value ?? 1),
                      })
                    }
                    aria-label="Serving size"
                  />
                  <span className="field-hint">Amount per serving.</span>
                </label>

                <label className="form-field">
                  <span className="field-label">Serving Unit</span>
                  <Dropdown
                    value={food.servingUnit}
                    onChange={(e) => handleServingUnitChange(e.value)}
                    options={[
                      ...MASS_UNITS,
                      ...VOLUME_UNITS,
                      ...CUSTOM_UNITS,
                      ...(food.measurements
                        ?.map((m) => m.unit)
                        .filter((u) => !([...MASS_UNITS, ...VOLUME_UNITS, ...CUSTOM_UNITS] as string[]).includes(u))
                        ?? []),
                    ].map((unit) => ({ label: unit, value: unit }))}
                    ariaLabel="Serving unit"
                  />
                  <span className="field-hint">Unit of measurement. {servingUnitCategory !== 'custom' ? `Changing this will filter measurements to ${servingUnitCategory} units.` : ''}</span>
                </label>

                {servingUnitCategory !== 'custom' && (
                  <label className="form-field">
                    <span className="field-label">Density (g/ml)</span>
                    <InputNumber
                      min={0}
                      minFractionDigits={0}
                      maxFractionDigits={4}
                      value={food.density ?? null}
                      onValueChange={(e) => setFood({ ...food, density: (e.value != null && e.value > 0) ? e.value : undefined })}
                      aria-label="Density in grams per millilitre"
                      placeholder="—"
                    />
                    <span className="field-hint">Optional. Enables mass ↔ volume conversions (e.g. 0.91 for olive oil).</span>
                  </label>
                )}

                <div className="form-field form-field-full">
                  <span className="field-label">Macronutrients (grams per serving)</span>
                  <div className="macro-grid">
                    <label className="macro-field">
                      <span className="macro-label">Protein</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.protein || 0}
                        onValueChange={(e) => handleMacroChange('protein', e.value)}
                        aria-label="Protein"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Carbs</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.carbs || 0}
                        onValueChange={(e) => handleMacroChange('carbs', e.value)}
                        aria-label="Carbohydrates"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Fat</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.fat || 0}
                        onValueChange={(e) => handleMacroChange('fat', e.value)}
                        aria-label="Fat"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Fiber</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.fiber || 0}
                        onValueChange={(e) => handleMacroChange('fiber', e.value)}
                        aria-label="Fiber"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Saturated Fat</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.saturatedFat ?? null}
                        onValueChange={(e) => handleOptionalMacroChange('saturatedFat', e.value)}
                        aria-label="Saturated fat"
                        placeholder="—"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Sugar</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={1}
                        value={food.sugar ?? null}
                        onValueChange={(e) => handleOptionalMacroChange('sugar', e.value)}
                        aria-label="Sugar"
                        placeholder="—"
                      />
                    </label>
                    <label className="macro-field">
                      <span className="macro-label">Sodium (mg)</span>
                      <InputNumber
                        className="macro-input"
                        min={0}
                        minFractionDigits={0}
                        maxFractionDigits={0}
                        value={food.sodium ?? null}
                        onValueChange={(e) => handleOptionalMacroChange('sodium', e.value)}
                        aria-label="Sodium in milligrams"
                        placeholder="—"
                      />
                    </label>
                  </div>
                </div>

                <div className="form-field form-field-full">
                  <span className="field-label">Available Measurements</span>
                  <div className="measurements-list">
                    {food.measurements?.map((m) => {
                      const isCustom = getUnitCategory(m.unit) === 'custom'
                      const canCalibrate = isCustom && (servingUnitCategory === 'mass' || (servingUnitCategory === 'volume' && food.density != null && food.density > 0))
                      const isUncalibrated = isCustom && !m.gramsPerUnit
                      return (
                        <div key={m.unit} className={`measurement-tag ${isUncalibrated && canCalibrate ? 'measurement-tag-warn' : ''}`}>
                          <span className="measurement-tag-label">
                            {isUncalibrated && canCalibrate && <span className="measurement-warn-icon" title="No gram weight set — calories cannot be calculated for this unit">⚠</span>}
                            {m.unit}
                          </span>
                          {canCalibrate && (
                            <input
                              type="number"
                              className="measurement-grams-input"
                              min={0}
                              step={0.1}
                              value={m.gramsPerUnit ?? ''}
                              placeholder="g/unit"
                              onChange={(e) => handleSetGramsPerUnit(m.unit, e.target.value ? Number(e.target.value) : undefined)}
                              aria-label={`Grams per ${m.unit}`}
                            />
                          )}
                          {m.gramsPerUnit && <span className="measurement-grams-label">{m.gramsPerUnit}g</span>}
                          <button
                            type="button"
                            className="measurement-remove"
                            onClick={() => handleRemoveMeasurement(m.unit)}
                            aria-label={`Remove ${m.unit}`}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
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
                    onClick={() => router.push('/foods')}
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
