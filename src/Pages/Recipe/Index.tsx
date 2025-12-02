import { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import './recipe.scss'
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
  if (recipe.date_published) {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - recipe.date_published.getTime())
    const daysSincePublished = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    publishedText = daysSincePublished > 0 ? `Published ${daysSincePublished} days ago` : "Published today"
  }

  const displayRecipe = editMode ? editedRecipe : recipe

  const totalCalories = displayRecipe.ingredients.reduce((total, ingredient) => {
    return total + (ingredient.calories || 0)
  }, 0)

  function handleSave() {
    const updatedRecipes = recipes.map(r => 
      r.id === editedRecipe.id ? editedRecipe : r
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

  function handleIngredientChange(index: number, field: keyof Ingredient, value: string | number) {
    const updatedIngredients = [...editedRecipe.ingredients]
    if (field === 'quantity') {
      const numValue = Number(value)
      const newQuantity = isNaN(numValue) || value === '' ? 0 : numValue
      
      // Check if this ingredient exists in context to get per-unit calories
      const existingIngredient = existingIngredients.find(
        ing => ing.name.toLowerCase() === updatedIngredients[index].name.toLowerCase()
      )
      
      if (existingIngredient) {
        // Recalculate calories based on new quantity and per-unit calories
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          quantity: newQuantity,
          calories: (existingIngredient.calories || 0) * newQuantity
        }
      } else {
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          quantity: newQuantity
        }
      }
    } else if (field === 'calories') {
      const numValue = Number(value)
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        [field]: isNaN(numValue) || value === '' ? 0 : numValue
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
    // Check if there's an empty ingredient slot already (prevents adding duplicates)
    const hasEmptyIngredient = editedRecipe.ingredients.some(ing => ing.name.trim() === '')
    if (hasEmptyIngredient) {
      return // Don't add another empty ingredient if one already exists
    }

    const newIngredient: Ingredient = { name: '', quantity: 1, calories: 0 }
    setEditedRecipe({ ...editedRecipe, ingredients: [...editedRecipe.ingredients, newIngredient] })
  }

  function handleIngredientNameChange(index: number, value: string) {
    const updatedIngredients = [...editedRecipe.ingredients]
    // Check if the ingredient name already exists in context's existingIngredients
    const existingIngredient = existingIngredients.find(
      ing => ing.name.toLowerCase() === value.toLowerCase()
    )
    
    if (existingIngredient) {
      // If it exists, use the existing ingredient's calories (per unit)
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        name: value,
        calories: (existingIngredient.calories || 0) * updatedIngredients[index].quantity
      }
    } else {
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        name: value
      }
    }
    setEditedRecipe({ ...editedRecipe, ingredients: updatedIngredients })
  }

  return (
    <div className="recipe-view">
      <div className="recipe-titlebar" aria-hidden="true">
        <span className="title">Forkful — {displayRecipe.name}</span>
      </div>

      <div className="recipe-content">
        <header className="recipe-header">
          <div>
            <Link to="/recipes" className="back-link">← All Recipes</Link>
            <p className="recipe-label">Recipe</p>
            {editMode ? (
              <input
                type="text"
                className="recipe-name-input"
                value={editedRecipe.name}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
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
            <div className="toolbar-actions">
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
                  {editMode && <th className="actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayRecipe.ingredients.map((ingredient, index) => (
                  <tr key={`ingredient-${index}`}>
                    {editMode ? (
                      <>
                        <td>
                          <input
                            type="text"
                            className="ingredient-name-input"
                            value={ingredient.name}
                            onChange={(e) => handleIngredientNameChange(index, e.target.value)}
                            list="existing-ingredients"
                            aria-label={`Ingredient ${index + 1} name`}
                          />
                          <datalist id="existing-ingredients">
                            {existingIngredients.map((ing, i) => (
                              <option key={i} value={ing.name} />
                            ))}
                          </datalist>
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
