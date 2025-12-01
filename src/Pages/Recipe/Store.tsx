import { useState, useContext, useMemo } from "react"
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
    onAdd(ingredient)
    setIngredient({ name: "", quantity: 1, calories: 0 })
  }
  


  const topExistingIngredients = useMemo(() => {
    let filteredIngredients = ingredient.name ? existingIngredients.filter(ing => ing.name.toLowerCase().includes(ingredient.name.toLowerCase()) && ing.name.toLowerCase() !== ingredient.name.toLowerCase()) : existingIngredients

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



function Store() {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)

  if (!recipeContext) {
    throw new Error("RecipeProvider is missing")
  }

  const { recipes, existingIngredients } = recipeContext
  
  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    name: "",
    meal: "",
    description: "",
    ingredients: [],
  })
    const ingredientCount = useMemo(() => {
    return recipe.ingredients ? recipe.ingredients.length : 0
  }, [recipe])
  const canSave = useMemo(() => {
    return !!(recipe.name && recipe.meal && recipe.description)
  }, [recipe])

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

  let detailsTabContent = (<form className="store-form">
              <div className="form-grid">
                <label className="form-field">
                  <span className="field-label">Name</span>
                  <input
                    className="text-input"
                    type="text"
                    value={recipe.name}
                    placeholder="e.g. Smoky chipotle chili"
                    onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                  />
                  <span className="field-hint">Give your recipe a clear, inviting title.</span>
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

    let ingredientsTabContent = (
    <form className="store-form">
      <div className="form-grid">
        <label className="form-field form-field-full">
          <span className="field-label">Ingredients</span>
        </label>
        {ingredientCount === 0 && <p className="no-ingredients-text">No ingredients added yet.</p>}
        
        <IngredientInput onAdd={handleAddIngredient} />
        {ingredientCount > 0 && recipe.ingredients.map((ingredient, index) => (
          <IngredientInput storedIngredient={ingredient} key={`${ingredient.name}-${index}`} onRemove={() => handleRemoveIngredient(index)} readOnly={true} />
        ))}
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
