import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './recipe.scss'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { type Recipe } from '@/types/Recipe'
import type { Ingredient } from '@/types/Ingredient'
import type { Food } from '@/types/Food'
import { useRecipeStore } from '@/stores/recipes'
import { useFoodStore } from '@/stores/food'
import { usePantryStore } from '@/stores/pantry'
import { calculateRecipeReadiness } from '@/utils/recipeReadiness'

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]
const DEFAULT_SERVING_UNIT = 'g'

interface RecipeProps {
  recipe: Recipe
  isEditing?: boolean
  canEdit?: boolean
}

export default function Recipe({ recipe, isEditing = false, canEdit = true }: RecipeProps) {
  const updateRecipeInStore = useRecipeStore((state) => state.updateRecipe)
  const foods = useFoodStore((state) => state.foods)
  const pantryItems = usePantryStore((state) => state.items)

  const [editMode, setEditMode] = useState(isEditing && canEdit)
  const [editedRecipe, setEditedRecipe] = useState<Recipe>({ ...recipe })

  const displayRecipe = editMode ? editedRecipe : recipe

  // Calculate recipe readiness - only when not in edit mode
  const readiness = useMemo(() => {
    if (editMode) return null
    return calculateRecipeReadiness(recipe, pantryItems)
  }, [recipe, pantryItems, editMode])

  let publishedText = "Unpublished"
  let isPublished = false
  if (recipe.date_published) {
    isPublished = true
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - recipe.date_published.getTime())
    const daysSincePublished = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    publishedText = daysSincePublished > 1 ? `Published ${daysSincePublished} days ago` : "Published today"
  }

  const totalCalories = displayRecipe.ingredients.reduce((total, ingredient) => {
    return total + (ingredient.calories || 0)
  }, 0)

  function handleSave() {
    const sanitizedIngredients = editedRecipe.ingredients.filter(
      ing => ing.food && ing.calories !== undefined && !Number.isNaN(ing.calories)
    )

    const updatedRecipe = { ...editedRecipe, ingredients: sanitizedIngredients }

    updateRecipeInStore(updatedRecipe)
    setEditMode(false)
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
    if (foods.length > 0) {
      const defaultFood = foods[0]
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
      calories: getPerUnitCalories(food) * updatedIngredients[index].quantity,
      servingUnit: food.servingUnit || updatedIngredients[index].servingUnit
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function publishRecipe() {
    const now = new Date()
    const updatedRecipe = { ...editedRecipe, date_published: now }
    updateRecipeInStore(updatedRecipe)
    setEditedRecipe(updatedRecipe)
  }

  function unpublishRecipe() {
    const updatedRecipe = { ...editedRecipe, date_published: null }
    updateRecipeInStore(updatedRecipe)
    setEditedRecipe(updatedRecipe)
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

  return (
    <div className="recipe-view">
      <div className="recipe-titlebar" aria-hidden="true">
        <span className="title">Forkful — {displayRecipe.name}</span>
      </div>

      <div className="recipe-content">
        <header className="recipe-header">
          <div className="recipe-header-container">
            <Link to="/recipes" className="back-link">← All Recipes</Link>
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
          <textarea
            className="recipe-description-input"
            value={editedRecipe.description}
            onChange={(e) => setEditedRecipe({ ...editedRecipe, description: e.target.value })}
            aria-label="Recipe description"
          />
        ) : (
          <p className="recipe-description">{displayRecipe.description}</p>
        )}

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
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="quantity-col">Quantity</th>
                  {editMode && <th className="unit-col">Unit</th>}
                  {editMode && <th className="calories-col">Calories</th>}
                  {editMode && <th className="actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayRecipe.ingredients.map((ingredient, index) => (
                  <tr key={`ingredient-${index}`}>
                    {editMode ? (
                      <>
                        <td>
                          <Autocomplete
                            value={ingredient.food.name}
                            options={foods}
                            getOptionLabel={(opt) => opt.name}
                            onChange={(next) => {
                              const food = foods.find(f => f.name.toLowerCase() === next.toLowerCase())
                              if (food) {
                                handleIngredientFoodChange(index, food)
                              }
                            }}
                            onSelect={(opt) => handleIngredientFoodChange(index, opt)}
                            placeholder="Select food"
                            inputAriaLabel={`Ingredient ${index + 1} name`}
                            renderOptionMeta={(opt) =>
                              opt.calories ? `${opt.calories} cal/serving` : undefined
                            }
                          />
                        </td>
                        <td className="quantity-col">
                          <input
                            type="number"
                            className="ingredient-quantity-input"
                            value={ingredient.quantity}
                            min={0}
                            onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                            aria-label={`Ingredient ${index + 1} quantity`}
                          />
                        </td>
                        <td className="unit-col">
                          <select
                            className="ingredient-unit-select"
                            value={ingredient.servingUnit}
                            onChange={(e) => handleIngredientChange(index, 'servingUnit', e.target.value)}
                            aria-label={`Ingredient ${index + 1} unit`}
                          >
                            {ingredient.food.measurements?.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                            {!ingredient.food.measurements?.includes(ingredient.servingUnit) && (
                              <option value={ingredient.servingUnit}>{ingredient.servingUnit}</option>
                            )}
                          </select>
                        </td>
                        <td className="calories-col">
                          <input
                            type="number"
                            className="ingredient-calories-input"
                            value={ingredient.calories ?? ''}
                            min={0}
                            onChange={(e) => handleIngredientChange(index, 'calories', e.target.value)}
                            aria-label={`Ingredient ${index + 1} calories`}
                          />
                        </td>
                        <td className="actions-col">
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleRemoveIngredient(index)}
                            aria-label={`Remove ${ingredient.food.name}`}
                          >
                            Remove
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{ingredient.food.name}</td>
                        <td className="quantity-col">{ingredient.quantity} {ingredient.servingUnit}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {editMode && (
              <button type="button" className="ghost-button add-ingredient-button" onClick={handleAddIngredient}>
                + Add Ingredient
              </button>
            )}
          </div>
        </section>

        {!editMode && readiness && readiness.totalIngredients > 0 && (
          <section className="recipe-panel">
            <div className="panel-toolbar">
              <div className="toolbar-tabs">
                <span className="tab is-active">Pantry Readiness</span>
                <span className="tab">{readiness.readinessScore}% ready</span>
              </div>
            </div>

            <div className="panel-content">
              <div className="readiness-summary">
                <p className="readiness-text">
                  <strong>{readiness.availableIngredients}</strong> of <strong>{readiness.totalIngredients}</strong> ingredients fully available
                  {readiness.partialIngredients > 0 && (
                    <>, <strong>{readiness.partialIngredients}</strong> partially available</>
                  )}
                  {readiness.missingIngredients > 0 && (
                    <>, <strong>{readiness.missingIngredients}</strong> missing</>
                  )}
                </p>
              </div>

              {(readiness.missingIngredients > 0 || readiness.partialIngredients > 0) && (
                <div className="missing-ingredients">
                  <h3 className="missing-ingredients-title">Items Needed</h3>
                  <table className="ingredient-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Status</th>
                        <th className="quantity-col">Available</th>
                        <th className="quantity-col">Needed</th>
                        <th className="quantity-col">Shortage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readiness.ingredientDetails
                        .filter(detail => !detail.isSufficient)
                        .map((detail, index) => (
                          <tr key={`missing-${index}`}>
                            <td>{detail.ingredient.food.name}</td>
                            <td>
                              {detail.available === 0 ? (
                                <span className="pill pill-danger">Missing</span>
                              ) : (
                                <span className="pill pill-warning">Insufficient</span>
                              )}
                            </td>
                            <td className="quantity-col">
                              {detail.available.toFixed(2)} {detail.unit}
                            </td>
                            <td className="quantity-col">
                              {detail.needed.toFixed(2)} {detail.unit}
                            </td>
                            <td className="quantity-col">
                              {detail.shortage.toFixed(2)} {detail.unit}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
