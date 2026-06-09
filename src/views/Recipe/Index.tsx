'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Toast } from 'primereact/toast'
import DOMPurify from 'dompurify'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { type Recipe } from '@/types/Recipe'
import type { RecipeStep } from '@/types/RecipeStep'
import type { Ingredient } from '@/types/Ingredient'
import type { Food } from '@/types/Food'
import { useRecipeStore } from '@/stores/recipes'
import {
  apiUpdateRecipe, apiSaveRecipe, apiUnsaveRecipe,
  apiCreateRecipeStep, apiUpdateRecipeStep, apiDeleteRecipeStep,
  apiReorderRecipeSteps, apiUploadImage,
} from '@/lib/api/recipes'
import { Editor } from 'primereact/editor'
import OpenFoodFactsImport from '@/components/OpenFoodFactsImport/OpenFoodFactsImport'
import { toSlug } from '@/utils/slug'
import { cuisineOptions, dietaryOptions } from '@/constants/userPreferences'

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]
const DEFAULT_SERVING_UNIT = 'g'

interface RecipeProps {
  recipe: Recipe
  foods: Food[]
  isEditing?: boolean
  canEdit?: boolean
  canSave?: boolean
  initialSaved?: boolean
}

export default function Recipe({ recipe, foods, isEditing = false, canEdit = true, canSave = false, initialSaved = false }: RecipeProps) {
  const updateRecipeInStore = useRecipeStore((state) => state.updateRecipe)
  const toast = useRef<Toast>(null)

  const [editMode, setEditMode] = useState(isEditing && canEdit)
  const [saved, setSaved] = useState(initialSaved)
  const [savePending, setSavePending] = useState(false)
  const [editedRecipe, setEditedRecipe] = useState<Recipe>({ ...recipe })
  const [localFoods, setLocalFoods] = useState<Food[]>(foods)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [steps, setSteps] = useState<RecipeStep[]>(recipe.steps ?? [])

  let publishedText = "Unpublished"
  let isPublished = false
  if (recipe.date_published) {
    isPublished = true
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - recipe.date_published.getTime())
    const daysSincePublished = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    publishedText = daysSincePublished > 1 ? `Published ${daysSincePublished} days ago` : "Published today"
  }

  const displayRecipe = editMode ? editedRecipe : recipe

  const totalCalories = displayRecipe.ingredients.reduce((total, ingredient) => {
    return total + (ingredient.calories || 0)
  }, 0)

  async function handleSave() {
    const sanitizedIngredients = editedRecipe.ingredients.filter(
      ing => ing.food && ing.calories !== undefined && !Number.isNaN(ing.calories)
    )

    const updatedRecipe = { ...editedRecipe, ingredients: sanitizedIngredients }
    try {
      const result = await apiUpdateRecipe(updatedRecipe)
      updateRecipeInStore(result)
      setEditMode(false)
    } catch (err) {
      console.error('Failed to persist recipe update:', err)
      toast.current?.show({ severity: 'error', summary: 'Could not save changes', detail: 'You may not have permission to edit this recipe.', life: 4000 })
    }
  }

  function handleCancel() {
    setEditedRecipe({ ...recipe })
    setEditMode(false)
  }

  function handleCopyRecipe() {
    // Placeholder for copy recipe functionality
    console.log('Copy recipe clicked:', recipe.name)
  }

  // Helper function to get per-unit calories for a food
  function getPerUnitCalories(food: Food): number {
    return food.calories || 0
  }

  function handleIngredientChange(index: number, field: keyof Ingredient, value: string | number) {
    const updatedIngredients = [...editedRecipe.ingredients]
    if (field === 'quantity') {
      const numValue = Number(value)
      const newQuantity = isNaN(numValue) || value === '' ? 0 : numValue
      
      // Recalculate calories based on new quantity and food's per-unit calories
      const food = updatedIngredients[index].food
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        quantity: newQuantity,
        calories: getPerUnitCalories(food) * newQuantity
      }
    } else if (field === 'calories') {
      const numValue = Number(value)
      const nextCalories = value === '' || isNaN(numValue) ? 0 : Math.max(0, numValue)
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        calories: nextCalories
      }
    } else if (field === 'servingUnit') {
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        servingUnit: value as string
      }
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function handleRemoveIngredient(index: number) {
    const updatedIngredients = editedRecipe.ingredients.filter((_, i) => i !== index)
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function handleAddIngredient() {
    // Block adding if any ingredient has missing calories
    const hasIncompleteCalories = editedRecipe.ingredients.some(
      ing => ing.calories === undefined || Number.isNaN(ing.calories)
    )
    if (hasIncompleteCalories) {
      return
    }

    // Check if there's an empty ingredient slot already (prevents adding duplicates)
    const hasEmptyIngredient = editedRecipe.ingredients.some(ing => !ing.food)
    if (hasEmptyIngredient) {
      return // Don't add another empty ingredient if one already exists
    }

    // Create a placeholder ingredient with the first food
    if (localFoods.length > 0) {
      const defaultFood = localFoods[0]
      const newIngredient: Ingredient = { 
        food: defaultFood, 
        quantity: 1, 
        calories: defaultFood.calories,
        servingUnit: defaultFood.servingUnit || DEFAULT_SERVING_UNIT
      }
      setEditedRecipe({ ...editedRecipe, ingredients: [...editedRecipe.ingredients, newIngredient] })
    }
  }

  function handleIngredientFoodChange(index: number, food: Food) {
    const updatedIngredients = [...editedRecipe.ingredients]
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      food: food,
      quantity: food.servingSize || 1,
      calories: getPerUnitCalories(food) * (food.servingSize || 1),
      servingUnit: food.servingUnit || updatedIngredients[index].servingUnit
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  const recipeSlug = toSlug(recipe.name)

  async function handleAddStep() {
    try {
      const step = await apiCreateRecipeStep(recipeSlug, { content: '' })
      setSteps((prev) => [...prev, step])
    } catch (err) {
      console.error('Failed to add step:', err)
      toast.current?.show({ severity: 'error', summary: 'Could not add step', life: 3000 })
    }
  }

  async function handleStepChange(stepId: number, field: 'title' | 'content', value: string) {
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, [field]: value } : s))
    try {
      await apiUpdateRecipeStep(recipeSlug, stepId, { [field]: value })
    } catch (err) {
      console.error('Failed to update step:', err)
    }
  }

  async function handleDeleteStep(stepId: number) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId))
    try {
      await apiDeleteRecipeStep(recipeSlug, stepId)
    } catch (err) {
      console.error('Failed to delete step:', err)
    }
  }

  async function handleMoveStep(stepId: number, direction: 'up' | 'down') {
    const idx = steps.findIndex((s) => s.id === stepId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === steps.length - 1) return
    const next = [...steps]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setSteps(next)
    try {
      await apiReorderRecipeSteps(recipeSlug, next.map((s) => s.id))
    } catch (err) {
      console.error('Failed to reorder steps:', err)
    }
  }

  async function handleStepImageUpload(stepId: number, file: File) {
    try {
      const url = await apiUploadImage(file)
      const step = steps.find((s) => s.id === stepId)
      if (!step) return
      const newContent = step.content + `<img src="${url}" alt="Step image" />`
      await handleStepChange(stepId, 'content', newContent)
    } catch (err) {
      console.error('Failed to upload step image:', err)
      toast.current?.show({ severity: 'error', summary: 'Could not upload image', life: 3000 })
    }
  }

  async function publishRecipe() {
    const updatedRecipe = { ...editedRecipe, date_published: new Date() }
    updateRecipeInStore(updatedRecipe)
    setEditedRecipe(updatedRecipe)
    try {
      await apiUpdateRecipe(updatedRecipe)
    } catch (err) {
      console.error('Failed to persist recipe publish:', err)
      updateRecipeInStore(editedRecipe)
      setEditedRecipe(editedRecipe)
      toast.current?.show({ severity: 'error', summary: 'Could not publish recipe', detail: 'You may not have permission to edit this recipe.', life: 4000 })
    }
  }

  async function unpublishRecipe() {
    const updatedRecipe = { ...editedRecipe, date_published: null }
    updateRecipeInStore(updatedRecipe)
    setEditedRecipe(updatedRecipe)
    try {
      await apiUpdateRecipe(updatedRecipe)
    } catch (err) {
      console.error('Failed to persist recipe unpublish:', err)
      updateRecipeInStore(editedRecipe)
      setEditedRecipe(editedRecipe)
      toast.current?.show({ severity: 'error', summary: 'Could not unpublish recipe', detail: 'You may not have permission to edit this recipe.', life: 4000 })
    }
  }

  async function togglePublic() {
    const updatedRecipe = { ...editedRecipe, isPublic: !editedRecipe.isPublic }
    updateRecipeInStore(updatedRecipe)
    setEditedRecipe(updatedRecipe)
    try {
      await apiUpdateRecipe(updatedRecipe)
    } catch (err) {
      console.error('Failed to toggle recipe visibility:', err)
      updateRecipeInStore(editedRecipe)
      setEditedRecipe(editedRecipe)
      toast.current?.show({ severity: 'error', summary: 'Could not change visibility', detail: 'You may not have permission to edit this recipe.', life: 4000 })
    }
  }

  async function toggleSaved() {
    if (savePending) return
    setSavePending(true)
    try {
      if (saved) {
        await apiUnsaveRecipe(toSlug(recipe.name))
        setSaved(false)
      } else {
        await apiSaveRecipe(toSlug(recipe.name))
        setSaved(true)
      }
    } catch (err) {
      console.error('Failed to toggle saved state:', err)
    } finally {
      setSavePending(false)
    }
  }

  const publishedButton = !isPublished ? (
    <button onClick={publishRecipe} type="button" className="ghost-button" disabled={displayRecipe.ingredients.length === 0}>
      Publish
    </button>
  ) : (
    <button onClick={unpublishRecipe} type="button" className="ghost-button">
      Unpublish
    </button>
  )

  const visibilityButton = canEdit && (
    <button onClick={togglePublic} type="button" className="ghost-button">
      {displayRecipe.isPublic ? 'Make Private' : 'Make Public'}
    </button>
  )

  return (
    <div className="recipe-view">
      <Toast ref={toast} position="bottom-right" />
      <div className="recipe-content">
        <header className="recipe-header">
          <div className="recipe-header-container">
            <Link href="/recipes" className="back-link">← All Recipes</Link>
            <p className="recipe-label">Recipe</p>
            {editMode ? (
              <input
                type="text"
                className="recipe-name-input"
                value={editedRecipe.name}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value.slice(0, 35) })}
                maxLength={45}
                aria-label="Recipe name"
              />
            ) : (
              <h2 className="recipe-name">{displayRecipe.name}</h2>
            )}
          </div>
          <div className="recipe-meta">
            <span className="pill pill-primary">{publishedText}</span>
            <span className="pill pill-ghost">
              {displayRecipe.ingredients.length} ingredients
            </span>
          </div>
        </header>

        {editMode ? (
          <Editor
            className="recipe-editor"
            value={editedRecipe.description}
            onTextChange={(e) => setEditedRecipe({ ...editedRecipe, description: e.htmlValue ?? '' })}
            aria-label="Recipe description"
            style={{ height: '140px' }}
          />
        ) : (
          <div
            className="recipe-description"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayRecipe.description) }}
          />
        )}

        {editMode && (
          <section className="recipe-meta-fields">
            <div className="meta-row">
              <label className="meta-field">
                <span className="meta-label">Prep time (min)</span>
                <input
                  type="number"
                  className="meta-input"
                  min={0}
                  value={editedRecipe.prepTime ?? ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, prepTime: e.target.value ? Number(e.target.value) : null })}
                  aria-label="Prep time in minutes"
                />
              </label>
              <label className="meta-field">
                <span className="meta-label">Cook time (min)</span>
                <input
                  type="number"
                  className="meta-input"
                  min={0}
                  value={editedRecipe.cookTime ?? ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, cookTime: e.target.value ? Number(e.target.value) : null })}
                  aria-label="Cook time in minutes"
                />
              </label>
              <label className="meta-field">
                <span className="meta-label">Total time (min)</span>
                <input
                  type="number"
                  className="meta-input"
                  min={0}
                  value={editedRecipe.totalTime ?? ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, totalTime: e.target.value ? Number(e.target.value) : null })}
                  aria-label="Total time in minutes"
                />
              </label>
            </div>
            <div className="meta-row">
              <label className="meta-field">
                <span className="meta-label">Cuisine</span>
                <select
                  className="meta-select"
                  value={editedRecipe.cuisineType ?? ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, cuisineType: e.target.value || null })}
                  aria-label="Cuisine type"
                >
                  <option value="">No cuisine</option>
                  {cuisineOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <fieldset className="meta-field meta-checkboxes">
                <legend className="meta-label">Dietary tags</legend>
                <div className="dietary-options">
                  {dietaryOptions.map((tag) => (
                    <label key={tag} className="dietary-option">
                      <input
                        type="checkbox"
                        checked={(editedRecipe.dietaryTags ?? []).includes(tag)}
                        onChange={(e) => {
                          const current = editedRecipe.dietaryTags ?? []
                          const next = e.target.checked
                            ? [...current, tag]
                            : current.filter((t) => t !== tag)
                          setEditedRecipe({ ...editedRecipe, dietaryTags: next })
                        }}
                        aria-label={tag}
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        )}

        {!editMode && (displayRecipe.prepTime || displayRecipe.cookTime || displayRecipe.totalTime || displayRecipe.cuisineType || (displayRecipe.dietaryTags ?? []).length > 0) && (
          <section className="recipe-meta-display">
            <div className="meta-pills">
              {displayRecipe.cuisineType && <span className="pill pill-ghost">{displayRecipe.cuisineType}</span>}
              {displayRecipe.prepTime && <span className="pill pill-ghost">Prep: {displayRecipe.prepTime}m</span>}
              {displayRecipe.cookTime && <span className="pill pill-ghost">Cook: {displayRecipe.cookTime}m</span>}
              {displayRecipe.totalTime && <span className="pill pill-ghost">Total: {displayRecipe.totalTime}m</span>}
              {(displayRecipe.dietaryTags ?? []).map((tag) => (
                <span key={tag} className="pill pill-primary">{tag}</span>
              ))}
            </div>
          </section>
        )}

        <section className="recipe-steps">
          <h3 className="steps-heading">Steps</h3>
          {steps.length === 0 && !editMode && (
            <p className="steps-empty">No steps added yet.</p>
          )}
          {steps.map((step, idx) => (
            <div key={step.id} className="step-block">
              <div className="step-header">
                <span className="step-number">{idx + 1}</span>
                {editMode ? (
                  <input
                    type="text"
                    className="step-title-input"
                    placeholder="Step title (optional)"
                    value={step.title ?? ''}
                    onChange={(e) => handleStepChange(step.id, 'title', e.target.value)}
                    aria-label={`Step ${idx + 1} title`}
                  />
                ) : (
                  step.title && <h4 className="step-title">{step.title}</h4>
                )}
                {editMode && (
                  <div className="step-controls">
                    <button type="button" className="ghost-button step-btn" onClick={() => handleMoveStep(step.id, 'up')} disabled={idx === 0} aria-label="Move step up">↑</button>
                    <button type="button" className="ghost-button step-btn" onClick={() => handleMoveStep(step.id, 'down')} disabled={idx === steps.length - 1} aria-label="Move step down">↓</button>
                    <button type="button" className="danger-button step-btn" onClick={() => handleDeleteStep(step.id)} aria-label={`Delete step ${idx + 1}`}>Remove</button>
                  </div>
                )}
              </div>
              {editMode ? (
                <div className="step-editor-wrap">
                  <Editor
                    value={step.content}
                    onTextChange={(e) => handleStepChange(step.id, 'content', e.htmlValue ?? '')}
                    style={{ height: '120px' }}
                    aria-label={`Step ${idx + 1} content`}
                  />
                  <label className="step-image-upload">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleStepImageUpload(step.id, file)
                      }}
                      aria-label={`Upload image for step ${idx + 1}`}
                    />
                    <span className="ghost-button">+ Image</span>
                  </label>
                </div>
              ) : (
                <div
                  className="step-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.content) }}
                />
              )}
            </div>
          ))}
          {editMode && (
            <button type="button" className="ghost-button add-step-button" onClick={handleAddStep}>
              + Add Step
            </button>
          )}
        </section>

        <section className="recipe-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              {editMode ? (
                <select
                  className="meal-select"
                  value={editedRecipe.meal || ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, meal: e.target.value as Recipe["meal"] })}
                  aria-label="Meal type"
                >
                  <option value="">Select meal</option>
                  {mealOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <span className="tab is-active">{displayRecipe.meal}</span>
              )}
              <span className="tab">{totalCalories} calories</span>
            </div>
            <div className={editMode ? 'toolbar-actions edit-actions' : 'toolbar-actions'}>
              {editMode ? (
                <>
                  <button type="button" className="ghost-button" onClick={handleCancel}>
                    Cancel
                  </button>
                  <button type="button" className="primary-button" onClick={handleSave}>
                    Save
                  </button>
                </>
              ) : (
                <>
                  {canSave && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={toggleSaved}
                      disabled={savePending}
                      aria-label={saved ? 'Remove from saved recipes' : 'Save recipe'}
                    >
                      {saved ? '★ Saved' : '☆ Save'}
                    </button>
                  )}
                  {visibilityButton}
                  {publishedButton}
                  <button type="button" className="ghost-button" onClick={handleCopyRecipe}>
                    Copy Recipe
                  </button>
                  {canEdit && (
                    <button type="button" className="primary-button" onClick={() => setEditMode(true)}>
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="panel-content">
            <DataTable value={displayRecipe.ingredients} className="ingredient-table" key={String(editMode)}>
              <Column
                header="Ingredient"
                body={(ingredient: Ingredient, opts) =>
                  editMode ? (
                    <Autocomplete
                      value={ingredient.food.name}
                      options={localFoods}
                      getOptionLabel={(opt) => opt.name}
                      onChange={(next) => {
                        const food = localFoods.find(f => f.name.toLowerCase() === next.toLowerCase())
                        if (food) {
                          handleIngredientFoodChange(opts.rowIndex, food)
                        } else if (next === '') {
                          handleIngredientFoodChange(opts.rowIndex, {
                            id: -1,
                            name: "",
                            calories: 0,
                            protein: 0,
                            carbs: 0,
                            fat: 0,
                            fiber: 0,
                            servingSize: 1,
                            servingUnit: "g",
                            measurements: []
                          })
                        }
                      }}
                      onSelect={(opt) => handleIngredientFoodChange(opts.rowIndex, opt)}
                      placeholder="Select food"
                      inputAriaLabel={`Ingredient ${opts.rowIndex + 1} name`}
                      renderOptionMeta={(opt) =>
                        opt.calories ? `${opt.calories} cal/serving` : undefined
                      }
                    />
                  ) : (
                    ingredient.food.name
                  )
                }
              />
              <Column
                header="Quantity"
                className="quantity-col"
                body={(ingredient: Ingredient, opts) =>
                  editMode ? (
                    <input
                      type="number"
                      className="ingredient-quantity-input"
                      value={ingredient.quantity}
                      min={0}
                      onChange={(e) => handleIngredientChange(opts.rowIndex, 'quantity', e.target.value)}
                      aria-label={`Ingredient ${opts.rowIndex + 1} quantity`}
                    />
                  ) : (
                    `${ingredient.quantity} ${ingredient.servingUnit}`
                  )
                }
              />
              {editMode && (
                <Column
                  header="Unit"
                  className="unit-col"
                  body={(ingredient: Ingredient, opts) => (
                    <select
                      className="ingredient-unit-select"
                      value={ingredient.servingUnit}
                      onChange={(e) => handleIngredientChange(opts.rowIndex, 'servingUnit', e.target.value)}
                      aria-label={`Ingredient ${opts.rowIndex + 1} unit`}
                    >
                      {ingredient.food.measurements?.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                      {!ingredient.food.measurements?.includes(ingredient.servingUnit) && (
                        <option value={ingredient.servingUnit}>{ingredient.servingUnit}</option>
                      )}
                    </select>
                  )}
                />
              )}
              {editMode && (
                <Column
                  header="Calories"
                  className="calories-col"
                  body={(ingredient: Ingredient, opts) => (
                    <input
                      type="number"
                      className="ingredient-calories-input"
                      value={ingredient.calories ?? ''}
                      min={0}
                      onChange={(e) => handleIngredientChange(opts.rowIndex, 'calories', e.target.value)}
                      aria-label={`Ingredient ${opts.rowIndex + 1} calories`}
                    />
                  )}
                />
              )}
              {editMode && (
                <Column
                  header="Actions"
                  className="actions-col"
                  body={(ingredient: Ingredient, opts) => (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleRemoveIngredient(opts.rowIndex)}
                      aria-label={`Remove ${ingredient.food.name}`}
                    >
                      Remove
                    </button>
                  )}
                />
              )}
            </DataTable>
            {editMode && (
              <div className="ingredient-actions">
                <button type="button" className="ghost-button add-ingredient-button" onClick={handleAddIngredient}>
                  + Add Ingredient
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowImportDialog(true)}
                >
                  Import from OpenFoodFacts
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <OpenFoodFactsImport
        visible={showImportDialog}
        onHide={() => setShowImportDialog(false)}
        onImport={(food) => setLocalFoods((prev) => [...prev, food])}
      />
    </div>
  )
}
