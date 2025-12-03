import { useState, useContext, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import GlobalRecipeContext, { type RecipeContextType } from "@/providers/RecipeProvider"
import GlobalFoodContext, { type FoodContextType } from "@/providers/FoodProvider"
import type { Recipe } from "@/types/Recipe"
import type { Ingredient } from "@/types/Ingredient"
import type { Food } from "@/types/Food"
import Autocomplete from "@/components/Autocomplete/Autocomplete"
import { toSlug } from "@/utils/slug"
import "./store.scss"

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]
const DEFAULT_SERVING_UNIT = 'g'

function IngredientInput({ onAdd, onRemove, readOnly, storedIngredient }: { onAdd?: (ingredient: Ingredient) => void, onRemove?: () => void, readOnly?: boolean, storedIngredient?: Ingredient }) {
  const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext)
  const foods = foodContext?.foods ?? []

  const defaultFood = foods.length > 0 ? foods[0] : null

  // Create initial ingredient state - handle case when no foods are available
  const createInitialIngredient = (): Ingredient | null => {
    if (storedIngredient) return storedIngredient
    if (!defaultFood) return null
    return {
      food: defaultFood,
      quantity: 1,
      calories: defaultFood.calories || 0,
      servingUnit: defaultFood.servingUnit || DEFAULT_SERVING_UNIT,
    }
  }

  const [ingredient, setIngredient] = useState<Ingredient | null>(createInitialIngredient())
  const [ingredientName, setIngredientName] = useState<string>(ingredient ? ingredient.food.name : "")
  const [missingFood, setMissingFood] = useState<boolean>(false)

  function handleAdd() {
    if (!ingredient || !ingredient.food?.id || ingredient.quantity <= 0 || missingFood) {
      return
    }
    onAdd?.(ingredient)
    if (defaultFood) {
      setIngredient({ 
        food: defaultFood, 
        quantity: 1, 
        calories: defaultFood.calories || 0,
        servingUnit: defaultFood.servingUnit || DEFAULT_SERVING_UNIT
      })
    }
  }

  function handleFoodSelect(food: Food) {
    if (!ingredient) return
    setIngredient({
      ...ingredient,
      food: food,
      calories: (food.calories || 0) * ingredient.quantity,
      servingUnit: food.servingUnit || ingredient.servingUnit
    })
  }

  function setIngredientQuantity(e: React.ChangeEvent<HTMLInputElement>) {
    if (!ingredient) return
    const quantity = parseInt(e.target.value)
    if (isNaN(quantity) || quantity < 0) {
      setIngredient({ ...ingredient, quantity: 0, calories: 0 })
      return
    }
    const caloriesPerUnit = ingredient.food?.calories || 0
    setIngredient({ ...ingredient, quantity, calories: caloriesPerUnit * quantity })
  }

  // If no foods available, show a message with link to create food
  if (!ingredient && !storedIngredient) {
    return (
      <div className="ingredient-input">
        <span className="no-foods-message">No foods available. <Link to="/foods/new">Add a food</Link> first.</span>
      </div>
    )
  }

  // Safety check for null ingredient
  if (!ingredient) return null

  return (
    <div className="ingredient-input">
        <label className={`form-field ${missingFood ? 'has-error' : ''}`}>
        <span className="field-label">Ingredient Name</span>
            <Autocomplete
              value={ingredientName}
              options={foods}
              getOptionLabel={(opt) => opt.name}
              onChange={(next) => {
                if (next !== ingredientName) {
                  setIngredientName(next)
                }
                const food = foods.find(f => f.name.toLowerCase() === next.toLowerCase())
                if (food) {
                  setMissingFood(false)
                  handleFoodSelect(food)
                } else {
                  setMissingFood(true)
                }
              }}
              onSelect={(food) => {
                setMissingFood(false)
                setIngredientName(food.name)
                handleFoodSelect(food)
              }}
              placeholder="Select food"
              inputAriaLabel="Ingredient name"
              readOnly={readOnly}
              inputClassName={missingFood ? 'input-error' : ''}
              renderOptionMeta={(opt) => opt.calories ? `${opt.calories} cal/serving` : undefined}
            />
            {missingFood && (
              <span className="field-error" role="alert">Please select a food from the list.</span>
            )}
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
        <span className="field-label">Unit</span>
        <select
          className="number-input ingredient-unit-select"
          value={ingredient.servingUnit}
          onChange={(e) => setIngredient({ ...ingredient, servingUnit: e.target.value })}
          disabled={readOnly}
        >
          {ingredient.food?.measurements?.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
          {ingredient.food?.measurements && !ingredient.food.measurements.includes(ingredient.servingUnit) && (
            <option value={ingredient.servingUnit}>{ingredient.servingUnit}</option>
          )}
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Calories</span>
        <input
            type="number"
            className="number-input ingredient-calories-input"
            min={0}
            value={ingredient.calories}
            readOnly={readOnly}
            onChange={(e) =>
            setIngredient({ ...ingredient, calories: parseInt(e.target.value) || 0 })
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
  const navigate = useNavigate()

  if (!recipeContext) {
    throw new Error("RecipeProvider is missing")
  }

  const { recipes, setRecipes } = recipeContext
  
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
    
    const currentIngredients = recipe.ingredients.map(ing => ing.food.name)
    let bestMatch: { recipe: Recipe; similarity: number } | null = null
    
    for (const existingRecipe of recipes) {
      const existingIngredients = existingRecipe.ingredients.map(ing => ing.food.name)
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

  function createRecipe(publish: boolean): Recipe {
    const newId = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1
    return {
      id: newId,
      name: recipe.name!.trim(),
      meal: recipe.meal,
      description: recipe.description!,
      ingredients: recipe.ingredients || [],
      date_added: new Date(),
      date_published: publish ? new Date() : null,
    }
  }

  function handleSaveRecipe() {
    if (!canSave) return
    
    const newRecipe = createRecipe(false)
    setRecipes([...recipes, newRecipe])
    navigate(`/recipes/${toSlug(newRecipe.name)}`)
  }

  function handlePublishRecipe() {
    if (!canPublish) return
    
    const newRecipe = createRecipe(true)
    setRecipes([...recipes, newRecipe])
    navigate(`/recipes/${toSlug(newRecipe.name)}`)
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
                  <button type="button" className="ghost-button" disabled={!canSave} onClick={handleSaveRecipe}>
                    Save Recipe
                  </button>
                  <button type="button" className="primary-button" disabled={!canPublish} onClick={handlePublishRecipe}>
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
          <IngredientInput storedIngredient={ingredient} key={`${ingredient.food.name}-${index}`} onRemove={() => handleRemoveIngredient(index)} readOnly={true} />
        ))}
        
        {similarRecipe && (
          <div className="similar-recipe-suggestion" role="alert">
            <span className="suggestion-icon">💡</span>
            <span className="suggestion-text">
              Similar recipe found: <Link to={`/recipes/${toSlug(similarRecipe.recipe.name)}`} className="suggestion-link">{similarRecipe.recipe.name}</Link> ({Math.round(similarRecipe.similarity * 100)}% ingredient match)
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
