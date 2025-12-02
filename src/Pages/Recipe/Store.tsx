import { useState, useContext, useMemo } from "react"
import { Link } from "react-router-dom"
import GlobalRecipeContext, { type RecipeContextType } from "@/providers/RecipeProvider"
import type { Recipe } from "@/types/Recipe"
import type { Ingredient } from "@/types/Ingredient"
import "./store.scss"

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]

function IngredientInput({ onAdd, onRemove, readOnly, storedIngredient }: { onAdd?: (ingredient: Ingredient) => void, onRemove?: () => void, readOnly?: boolean, storedIngredient?: Ingredient }) {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)
  const existingIngredients = recipeContext?.existingIngredients ?? []

  const [ingredient, setIngredient] = useState<Ingredient>(storedIngredient ?? {
    name: "",
    quantity: 1,
    calories: 0,
  })

  function handleAdd() {
    if (ingredient.name.trim() === "" || ingredient.quantity <= 0) {
      return
    }
    onAdd?.(ingredient)
    setIngredient({ name: "", quantity: 1, calories: 0 })
  }
  


  const topExistingIngredients = useMemo(() => {
    const filteredIngredients = ingredient.name ? existingIngredients.filter(ing => ing.name.toLowerCase().includes(ingredient.name.toLowerCase()) && ing.name.toLowerCase() !== ingredient.name.toLowerCase()) : existingIngredients

    return filteredIngredients.slice(0, 3)
  }, [ingredient, existingIngredients])


  function fromExisitingIngredient(name: string, existingIngredients: Ingredient[]) {
    return existingIngredients.some(ing => ing.name.toLowerCase() === name.toLowerCase())
  }
  

  function setCaloriesFromExisiting() {
    const existing = existingIngredients.find(ing => ing.name.toLowerCase() === ingredient.name.toLowerCase())
    if (existing) {
      setIngredient({ ...ingredient, calories: (existing.calories || 0) * (ingredient.quantity || 1) })
    }
  }

  function setIngredientQuantity(e: React.ChangeEvent<HTMLInputElement>) {
    const quantity = parseInt(e.target.value)
    if (isNaN(quantity) || quantity < 0) {
      setIngredient({ ...ingredient, quantity: 0, calories: 0 })
      return
    }
    let caloriesPerUnit = 0
    const existing = existingIngredients.find(ing => ing.name.toLowerCase() === ingredient.name.toLowerCase())
    if (existing) {
      caloriesPerUnit = existing.calories || 0
    }
    setIngredient({ ...ingredient, quantity, calories: caloriesPerUnit * quantity })
  }
  return (
    <div className="ingredient-input">
        <label className="form-field">
        <span className="field-label">Ingredient Name</span>
            <input
                type="text"
                className="text-input ingredient-name-input"
                list="ingredient-suggestions"
                placeholder="Ingredient name"
                value={ingredient.name}
                onChange={(e) => setIngredient({ ...ingredient, name: e.target.value })}
                onBlur={setCaloriesFromExisiting}
                readOnly={readOnly}
            />
            <datalist id="ingredient-suggestions">
                {topExistingIngredients.map((ing, index) => (
                <option key={index} value={ing.name} />
                ))}
            </datalist>
        </label>
      <label className="form-field">
        <span className="field-label">Quantity</span>
        <input
          type="number"
          className="number-input ingredient-quantity-input"
          min={0}
          value={ingredient.quantity}
          onChange={setIngredientQuantity}
          readOnly={readOnly}
            />
        </label>
      <label className="form-field">
        <span className="field-label">Calories</span>
        <input
            type="number"
            className="number-input ingredient-calories-input"
            min={0}
            value={ingredient.calories}
            readOnly={fromExisitingIngredient(ingredient.name, existingIngredients) || readOnly}
            onChange={(e) =>
            setIngredient({ ...ingredient, calories: parseInt(e.target.value)})
            }
        />
        </label>
      {readOnly ? <button type="button" className="danger-button ingredient-action-button" onClick={onRemove}>
        -
      </button> :  <button type="button" className="primary-button ingredient-action-button" onClick={handleAdd}>
        +
      </button>}
    </div>
  )
}



/**
 * Calculate Jaccard similarity between two sets of ingredient names.
 * Returns a value between 0 and 1, where 1 means identical sets.
 * When both sets are empty, returns 0 (no meaningful similarity for comparison).
 */
function calculateJaccardSimilarity(ingredientsA: string[], ingredientsB: string[]): number {
  const normalizedA = ingredientsA.map(name => name.toLowerCase().trim())
  const normalizedB = ingredientsB.map(name => name.toLowerCase().trim())
  
  const setA = new Set(normalizedA)
  const setB = new Set(normalizedB)
  
  // If either set is empty, there's no meaningful similarity for recipe comparison
  if (setA.size === 0 || setB.size === 0) return 0
  
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  
  return intersection.size / union.size
}

function Store() {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)

  if (!recipeContext) {
    throw new Error("RecipeProvider is missing")
  }

  const { recipes } = recipeContext
  
  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    name: "",
    meal: undefined,
    description: "",
    ingredients: [],
  })
  
  const ingredientCount = useMemo(() => {
    return recipe.ingredients ? recipe.ingredients.length : 0
  }, [recipe])

  // Check for duplicate recipe name (case-insensitive, trimmed)
  const isDuplicateName = useMemo(() => {
    const trimmedName = recipe.name?.trim().toLowerCase()
    if (!trimmedName) return false
    return recipes.some(r => r.name.trim().toLowerCase() === trimmedName)
  }, [recipe.name, recipes])

  // Find similar recipes based on ingredient overlap using Jaccard similarity
  const similarRecipe = useMemo(() => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return null
    
    const currentIngredients = recipe.ingredients.map(ing => ing.name)
    let bestMatch: { recipe: Recipe; similarity: number } | null = null
    
    for (const existingRecipe of recipes) {
      const existingIngredients = existingRecipe.ingredients.map(ing => ing.name)
      const similarity = calculateJaccardSimilarity(currentIngredients, existingIngredients)
      
      // Only suggest if similarity is above 30%
      if (similarity >= 0.3 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { recipe: existingRecipe, similarity }
      }
    }
    
    return bestMatch
  }, [recipe.ingredients, recipes])

  const canSave = useMemo(() => {
    return !!(recipe.name && recipe.meal && recipe.description && !isDuplicateName)
  }, [recipe, isDuplicateName])

    const canPublish = useMemo(() => {
        return !!(canSave && ingredientCount > 0)
    }, [canSave, ingredientCount])


  const [activeTab, setActiveTab] = useState<"details" | "ingredients">("details")
  
  function handleAddIngredient(ingredient: Ingredient) {
    setRecipe({
        ...recipe,
        ingredients: [...(recipe.ingredients || []), ingredient],
    })
  }

  function handleRemoveIngredient(index: number) {
    if (!recipe.ingredients) return
    const updatedIngredients = [...recipe.ingredients]
    updatedIngredients.splice(index, 1)
    setRecipe({
        ...recipe,
        ingredients: updatedIngredients,
    })
  }

  const detailsTabContent = (<form className="store-form">
              <div className="form-grid">
                <label className={`form-field ${isDuplicateName ? 'has-error' : ''}`}>
                  <span className="field-label">Name</span>
                  <input
                    className={`text-input ${isDuplicateName ? 'input-error' : ''}`}
                    type="text"
                    value={recipe.name}
                    placeholder="e.g. Smoky chipotle chili"
                    onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                    aria-invalid={isDuplicateName}
                    aria-describedby={isDuplicateName ? "name-error" : undefined}
                  />
                  {isDuplicateName ? (
                    <span id="name-error" className="field-error" role="alert">A recipe with this name already exists.</span>
                  ) : (
                    <span className="field-hint">Give your recipe a clear, inviting title.</span>
                  )}
                </label>

                <div className="form-field">
                  <span className="field-label">Meal</span>
                  <div className="radio-group">
                    {mealOptions.map((option) => (
                      <label
                        key={option}
                        className={`radio-option ${recipe.meal === option ? "is-active" : ""}`}
                      >
                        <input
                          className="radio-input"
                          type="radio"
                          name="meal"
                          value={option}
                          checked={recipe.meal === option}
                          onChange={(e) =>
                            setRecipe({ ...recipe, meal: e.target.value as Recipe["meal"] })
                          }
                        />
                        <span className="radio-dot" />
                        {option}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Pick where this dish fits best.</span>
                </div>

                <label className="form-field form-field-full">
                  <span className="field-label">Description</span>
                  <textarea
                    className="text-area"
                    value={recipe.description}
                    placeholder="Describe flavors, prep time, or serving ideas."
                    onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
                  />
                  <span className="field-hint">Keep it short—add detailed steps later.</span>
                </label>
              </div>

              <div className="form-footer">
                <div className="footer-actions">
                  <button type="button" className="ghost-button" disabled={!canSave}>
                    Save Recipe
                  </button>
                  <button type="button" className="primary-button" disabled={!canPublish}>
                    Publish
                  </button>
                </div>
              </div>
            </form>);

    const ingredientsTabContent = (
    <form className="store-form">
      <div className="form-grid">
        <label className="form-field form-field-full">
          <span className="field-label">Ingredients</span>
        </label>
        {ingredientCount === 0 && <p className="no-ingredients-text">No ingredients added yet.</p>}
        
        <IngredientInput onAdd={handleAddIngredient} />
        {ingredientCount > 0 && recipe.ingredients?.map((ingredient, index) => (
          <IngredientInput storedIngredient={ingredient} key={`${ingredient.name}-${index}`} onRemove={() => handleRemoveIngredient(index)} readOnly={true} />
        ))}
        
        {similarRecipe && (
          <div className="similar-recipe-suggestion" role="alert">
            <span className="suggestion-icon">💡</span>
            <span className="suggestion-text">
              Similar recipe found: <Link to={`/recipes/${similarRecipe.recipe.id}`} className="suggestion-link">{similarRecipe.recipe.name}</Link> ({Math.round(similarRecipe.similarity * 100)}% ingredient match)
            </span>
          </div>
        )}
      </div>
    </form>
  )

  return (
    <div className="recipe-store">
      <div className="store-titlebar" aria-hidden="true">
        <span className="title">Forkful — {recipe.name || "New Recipe"}</span>
      </div>

      <div className="store-content">
        <header className="store-header">
          <div>
            <p className="store-label">Recipe Builder</p>
            <h2 className="store-name">Add New Recipe</h2>
            <p className="store-helper">
              Capture the basics now; you can return to add ingredients and directions later.
            </p>
          </div>
          <div className="store-meta">
            <span className="pill pill-primary">Draft</span>
            <span className="pill pill-ghost">{ingredientCount} ingredients</span>
            <span className="pill pill-ghost">{recipes.length} saved</span>
          </div>
        </header>

        <section className="store-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className={`tab ${activeTab === "details" ? "is-active" : ""}`} onClick={() => setActiveTab("details")} role="button" aria-label="Details Tab" aria-selected={activeTab === "details"}>Details</span>
              <span className={`tab ${activeTab === "ingredients" ? "is-active" : ""}`} onClick={() => setActiveTab("ingredients")} role="button" aria-label="Ingredients Tab" aria-selected={activeTab === "ingredients"}>Ingredients</span>
            </div>
          </div>

          <div className="panel-content">
            {activeTab === "details" ? detailsTabContent : ingredientsTabContent}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Store
