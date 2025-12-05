import { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import './recipe.scss'
import Autocomplete from '@/components/Autocomplete/Autocomplete'
import { type Recipe } from '@/types/Recipe'
import type { Ingredient } from '@/types/Ingredient'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]

interface RecipeProps {
  recipe: Recipe
  isEditing?: boolean
  canEdit?: boolean
}

export default function Recipe({ recipe, isEditing = false, canEdit = true }: RecipeProps) {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)
  
  if (!recipeContext) {
    throw new Error('RecipeProvider is missing')
  }

  const { recipes, setRecipes, existingIngredients } = recipeContext

  const [editMode, setEditMode] = useState(isEditing && canEdit)
  const [editedRecipe, setEditedRecipe] = useState<Recipe>({ ...recipe })

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

  function handleSave() {
    const sanitizedIngredients = editedRecipe.ingredients.filter(
      ing => ing.name.trim() !== '' && ing.calories !== undefined && ing.calories !== null && !Number.isNaN(ing.calories)
    )

    const updatedRecipe = { ...editedRecipe, ingredients: sanitizedIngredients }

    const updatedRecipes = recipes.map(r => 
      r.id === updatedRecipe.id ? updatedRecipe : r
    )
    setRecipes(updatedRecipes)
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

  // Helper function to check if an ingredient is an existing ingredient from context
  function isExistingIngredient(ingredientName: string): boolean {
    return existingIngredients.some(
      ing => ing.name.toLowerCase() === ingredientName.toLowerCase()
    )
  }

  // Helper function to get per-unit calories for an existing ingredient
  function getPerUnitCalories(ingredientName: string): number {
    const existing = existingIngredients.find(
      ing => ing.name.toLowerCase() === ingredientName.toLowerCase()
    )
    return existing?.calories || 0
  }

  function handleIngredientChange(index: number, field: keyof Ingredient, value: string | number) {
    const updatedIngredients = [...editedRecipe.ingredients]
    if (field === 'quantity') {
      const numValue = Number(value)
      const newQuantity = isNaN(numValue) || value === '' ? 0 : numValue
      
      // Check if this ingredient exists in context to get per-unit calories
      const ingredientName = updatedIngredients[index].name
      
      if (isExistingIngredient(ingredientName)) {
        // Recalculate calories based on new quantity and per-unit calories
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          quantity: newQuantity,
          calories: getPerUnitCalories(ingredientName) * newQuantity
        }
      } else {
        // For new ingredients, scale calories proportionally if there was a previous quantity
        const oldQuantity = updatedIngredients[index].quantity || 1
        const oldCalories = updatedIngredients[index].calories
        const perUnitCalories = oldCalories && oldQuantity > 0 ? oldCalories / oldQuantity : undefined
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          quantity: newQuantity,
          calories: perUnitCalories !== undefined ? Math.round(perUnitCalories * newQuantity) : undefined
        }
      }
    } else if (field === 'calories') {
      const numValue = Number(value)
      const nextCalories = value === '' || isNaN(numValue) ? undefined : Math.max(0, numValue)
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        calories: nextCalories
      }
    } else {
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        [field]: value
      }
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function handleRemoveIngredient(index: number) {
    const updatedIngredients = editedRecipe.ingredients.filter((_, i) => i !== index)
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function handleAddIngredient() {
    // Block adding if any ingredient has a name but missing calories
    const hasIncompleteCalories = editedRecipe.ingredients.some(
      ing => ing.name.trim() !== '' && (ing.calories === undefined || ing.calories === null || Number.isNaN(ing.calories))
    )
    if (hasIncompleteCalories) {
      return
    }

    // Check if there's an empty ingredient slot already (prevents adding duplicates)
    const hasEmptyIngredient = editedRecipe.ingredients.some(ing => ing.name.trim() === '')
    if (hasEmptyIngredient) {
      return // Don't add another empty ingredient if one already exists
    }

    const newIngredient: Ingredient = { name: '', quantity: 1, calories: undefined }
    setEditedRecipe({ ...editedRecipe, ingredients: [...editedRecipe.ingredients, newIngredient] })
  }

  function handleIngredientNameChange(index: number, value: string) {
    const updatedIngredients = [...editedRecipe.ingredients]
    
    if (isExistingIngredient(value)) {
      // If it exists, use the existing ingredient's calories (per unit)
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        name: value,
        calories: getPerUnitCalories(value) * updatedIngredients[index].quantity
      }
    } else {
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        name: value,
        calories: undefined
      }
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  function publishRecipe() {
    const now = new Date()
    const updatedRecipe = { ...editedRecipe, date_published: now }
    const updatedRecipes = recipes.map(r => 
      r.id === updatedRecipe.id ? updatedRecipe : r
    )
    setRecipes(updatedRecipes)
    setEditedRecipe(updatedRecipe)
  }

  function unpublishRecipe() {
    const updatedRecipe = { ...editedRecipe, date_published: null }
    const updatedRecipes = recipes.map(r => 
      r.id === updatedRecipe.id ? updatedRecipe : r
    )
    setRecipes(updatedRecipes)
    setEditedRecipe(updatedRecipe)
  }

  let publishedButton = !isPublished ? (
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
                            value={ingredient.name}
                            options={existingIngredients}
                            getOptionLabel={(opt) => opt.name}
                            onChange={(next) => handleIngredientNameChange(index, next)}
                            onSelect={(opt) => handleIngredientNameChange(index, opt.name)}
                            placeholder="Ingredient name"
                            inputAriaLabel={`Ingredient ${index + 1} name`}
                            renderOptionMeta={(opt) =>
                              opt.calories ? `${opt.calories} cal/unit` : undefined
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
                        <td className="calories-col">
                          <input
                            type="number"
                            className="ingredient-calories-input"
                            value={ingredient.calories ?? ''}
                            min={0}
                            onChange={(e) => handleIngredientChange(index, 'calories', e.target.value)}
                            disabled={isExistingIngredient(ingredient.name)}
                            aria-label={`Ingredient ${index + 1} calories`}
                            title={isExistingIngredient(ingredient.name) ? 'Calories auto-calculated from existing ingredient' : 'Enter calories'}
                          />
                        </td>
                        <td className="actions-col">
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleRemoveIngredient(index)}
                            aria-label={`Remove ${ingredient.name}`}
                          >
                            Remove
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{ingredient.name}</td>
                        <td className="quantity-col">{ingredient.quantity}</td>
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
      </div>
    </div>
  )
}
