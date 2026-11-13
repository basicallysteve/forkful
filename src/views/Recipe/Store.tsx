'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Recipe, CreateRecipeInput } from "@/types/Recipe"
import type { Ingredient } from "@/types/Ingredient"
import type { Food } from "@/types/Food"
import Autocomplete from "@/components/Autocomplete/Autocomplete"
import { toRecipeUrl } from "@/utils/slug"
import { calculateCalories, getAllowedUnits } from "@/utils/unitConversion"
import { useRecipeStore } from "@/stores/recipes"
import { useFoodStore } from "@/stores/food"
import { apiCreateRecipe } from "@/lib/api/recipes"
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import QuantityInput from '@/components/QuantityInput/QuantityInput'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { RadioButton } from 'primereact/radiobutton'
import { Editor } from 'primereact/editor'
import MarkdownImport from './MarkdownImport'
import RecipeImporter from './RecipeImporter'
import './markdownImport.scss'

const mealOptions: Recipe["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]
const DEFAULT_SERVING_UNIT = 'g'

function IngredientInput({ onAdd, onChange, onRemove, storedIngredient }: { onAdd?: (ingredient: Ingredient) => void, onChange?: (ingredient: Ingredient) => void, onRemove?: () => void, storedIngredient?: Ingredient }) {
  const isStored = !!storedIngredient
  const foods = useFoodStore((state) => state.foods)

  const defaultFood = foods.length > 0 ? foods[0] : null

  // Create initial ingredient state - handle case when no foods are available
  const createInitialIngredient = (): Ingredient | null => {
    if (!defaultFood) return null
    return {
      food: defaultFood,
      quantity: 1,
      calories: defaultFood.calories || 0,
      servingUnit: defaultFood.servingUnit || DEFAULT_SERVING_UNIT,
    }
  }

  // Stored rows render straight from the recipe (no local copy, so they can never go stale);
  // only the blank "new ingredient" row keeps local draft state.
  const [draftIngredient, setIngredient] = useState<Ingredient | null>(createInitialIngredient())
  const ingredient = storedIngredient ?? draftIngredient
  // The add row starts blank: no food is chosen until the user picks one.
  const [draftName, setIngredientName] = useState<string>("")
  const [foodChosen, setFoodChosen] = useState<boolean>(false)
  const blank = !isStored && !foodChosen
  const ingredientName = storedIngredient ? storedIngredient.food.name : draftName
  const [missingFood, setMissingFood] = useState<boolean>(false)
  const [quantityKey, setQuantityKey] = useState(0)

  // Edits to an already-added ingredient must reach the recipe, not just this row's local state.
  function updateIngredient(next: Ingredient) {
    if (isStored) onChange?.(next)
    else setIngredient(next)
  }

  function handleAdd() {
    if (!ingredient || !foodChosen || !ingredient.food?.id || ingredient.quantity <= 0 || missingFood) {
      return
    }
    onAdd?.(ingredient)
    // Reset the add row to blank
    setQuantityKey((k) => k + 1)
    setIngredientName("")
    setFoodChosen(false)
    setMissingFood(false)
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
    setFoodChosen(true)
    setQuantityKey((k) => k + 1)
    setIngredient({
      ...ingredient,
      food: food,
      quantity: food.servingSize || 1,
      calories: (food.calories || 0),
      servingUnit: food.servingUnit || ingredient.servingUnit
    })
  }

  function setIngredientQuantity(value: number | null | undefined) {
    if (!ingredient) return
    const quantity = value ?? 0
    if (quantity < 0) {
      updateIngredient({ ...ingredient, quantity: 0, calories: 0 })
      return
    }
    const caloriesPerUnit = calculateCalories({
      baseCalories: ingredient.food?.calories || 0,
      baseServingSize: ingredient.food?.servingSize || 1,
      baseServingUnit: ingredient.food?.servingUnit || DEFAULT_SERVING_UNIT,
      targetAmount: 1,
      targetUnit: ingredient.servingUnit,
      density: ingredient.food?.density,
    }) || 0
    updateIngredient({ ...ingredient, quantity, calories: caloriesPerUnit * quantity })
  }

  function handleUnitChange(newUnit: string) {
    if (!ingredient || !ingredient.food) return
    
    const food = ingredient.food
    const baseCalories = food.calories || 0
    const baseServingSize = food.servingSize || 1
    const baseServingUnit = food.servingUnit || DEFAULT_SERVING_UNIT
    
    // Calculate calories based on the new unit
    const calculatedCalories = calculateCalories({
      baseCalories,
      baseServingSize,
      baseServingUnit,
      targetAmount: ingredient.quantity,
      targetUnit: newUnit,
      density: food.density,
    })
    
    // If conversion is possible, use calculated calories; otherwise keep current calories
    const newCalories = calculatedCalories !== null 
      ? Math.round(calculatedCalories) 
      : ingredient.calories
    
    updateIngredient({
      ...ingredient,
      servingUnit: newUnit,
      calories: newCalories,
    })
  }

  // If no foods available, show a message with link to create food
  if (!ingredient) {
    return (
      <div className="ingredient-input">
        <span className="no-foods-message">No foods available. <Link href="/foods/new">Add a food</Link> first.</span>
      </div>
    )
  }

  // Safety check for null ingredient
  if (!ingredient) return null

  return (
    <div className={`ingredient-input ${isStored ? 'ingredient-input--stored' : 'ingredient-input--new'}`} role="group" aria-label={isStored ? `Ingredient ${ingredient.food.name}` : 'Add an ingredient'}>
      {!isStored && <span className="ingredient-input-title">Add an ingredient</span>}
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
                  setFoodChosen(false)
                  setMissingFood(next.trim() !== "")
                }
              }}
              onSelect={(food) => {
                setMissingFood(false)
                setIngredientName(food.name)
                handleFoodSelect(food)
              }}
              placeholder="Select food"
              inputAriaLabel="Ingredient name"
              readOnly={isStored}
              inputClassName={missingFood ? 'input-error' : ''}
              renderOptionMeta={(opt) => opt.calories ? `${opt.calories} cal/serving` : undefined}
            />
            {missingFood && (
              <span className="field-error" role="alert">Please select a food from the list.</span>
            )}
        </label>
      <label className="form-field">
        <span className="field-label">Quantity</span>
        {/* A disabled fieldset disables QuantityInput while the add row is blank. The key remounts it
            (it keeps its own text) whenever the row's quantity is set from outside. */}
        <fieldset className="ingredient-quantity-field" disabled={blank}>
          <QuantityInput
            key={quantityKey}
            className="ingredient-quantity-input"
            value={blank ? null : ingredient.quantity}
            unit={ingredient.servingUnit}
            onChange={setIngredientQuantity}
          />
        </fieldset>
        </label>
      <label className="form-field">
        <span className="field-label">Unit</span>
        <Dropdown
          className="ingredient-unit-select"
          value={blank ? null : ingredient.servingUnit}
          placeholder="Unit"
          disabled={blank}
          onChange={(e) => handleUnitChange(e.value)}
          options={(() => {
            const food = ingredient.food
            const stored = (food?.measurements || []).map((m) => m.unit)
            const allowed = food
              ? getAllowedUnits(food.servingUnit, food.density).filter(u => !stored.includes(u))
              : []
            const all = [...stored, ...allowed]
            const extra = ingredient.servingUnit && !all.includes(ingredient.servingUnit)
              ? [ingredient.servingUnit]
              : []
            return [...all, ...extra].map((unit) => ({ label: unit, value: unit }))
          })()}
          ariaLabel="Serving unit"
        />
      </label>
      <label className="form-field">
        <span className="field-label">Calories</span>
        <InputNumber
            className="ingredient-calories-input"
            min={0}
            value={blank ? null : ingredient.calories}
            disabled={blank}
            onValueChange={(e) =>
            updateIngredient({ ...ingredient, calories: e.value ?? 0 })
            }
            aria-label="Calories"
        />
        </label>
      {isStored ? (
        <Button type="button" icon="pi pi-trash" severity="danger" outlined className="ingredient-action-button" aria-label={`Remove ${ingredient.food.name}`} tooltip="Remove" tooltipOptions={{ position: 'top' }} onClick={onRemove} />
      ) : (
        <Button type="button" icon="pi pi-plus" label="Add" className="ingredient-action-button" aria-label="Add ingredient" disabled={blank || ingredient.quantity <= 0} onClick={handleAdd} />
      )}
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
  const router = useRouter()
  const recipes = useRecipeStore((state) => state.recipes)
  const addRecipeToStore = useRecipeStore((state) => state.addRecipe)

  const [inputMode, setInputMode] = useState<'guided' | 'markdown' | 'import'>('guided')

  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    name: "",
    meal: undefined,
    description: "",
    ingredients: [],
  })
  
  const ingredientCount = useMemo(() => {
    return recipe.ingredients ? recipe.ingredients.length : 0
  }, [recipe])

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
    // A stored row with invalid or zero quantity text has quantity 0; block saving it as "0 slice".
    const quantitiesValid = recipe.ingredients.every((ingredient) => ingredient.quantity > 0)
    return !!(recipe.name && recipe.meal && recipe.description && quantitiesValid)
  }, [recipe])

    const canPublish = useMemo(() => {
        return !!(canSave && ingredientCount > 0)
    }, [canSave, ingredientCount])


  const [activeTab, setActiveTab] = useState<"details" | "ingredients">("details")
  
  // Stable client-side row keys, parallel to recipe.ingredients (never sent to the API).
  const [ingredientRowIds, setIngredientRowIds] = useState<string[]>([])

  function handleAddIngredient(ingredient: Ingredient) {
    setIngredientRowIds((ids) => [...ids, crypto.randomUUID()])
    setRecipe({
        ...recipe,
        ingredients: [...(recipe.ingredients || []), ingredient],
    })
  }

  function handleUpdateIngredient(index: number, updated: Ingredient) {
    setRecipe((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).map((ing, i) => (i === index ? updated : ing)),
    }))
  }

  function handleRemoveIngredient(index: number) {
    if (!recipe.ingredients) return
    const updatedIngredients = [...recipe.ingredients]
    updatedIngredients.splice(index, 1)
    setIngredientRowIds((ids) => ids.filter((_, i) => i !== index))
    setRecipe({
        ...recipe,
        ingredients: updatedIngredients,
    })
  }

  function createRecipe(publish: boolean): CreateRecipeInput {
    return {
      name: recipe.name!.trim(),
      meal: recipe.meal,
      description: recipe.description!,
      ingredients: recipe.ingredients || [],
      serves: recipe.serves ?? null,
      date_added: new Date(),
      date_published: publish ? new Date() : null,
      isPublic: publish,
    }
  }

  async function handleSaveRecipe() {
    if (!canSave) return
    try {
      const newRecipe = createRecipe(false)
      const created = await apiCreateRecipe(newRecipe)
      addRecipeToStore(created)
      router.push(toRecipeUrl(created.shortId, created.name))
    } catch (err) {
      console.error('Failed to persist new recipe:', err)
    }
  }

  async function handlePublishRecipe() {
    if (!canPublish) return
    try {
      const newRecipe = createRecipe(true)
      const created = await apiCreateRecipe(newRecipe)
      addRecipeToStore(created)
      router.push(toRecipeUrl(created.shortId, created.name))
    } catch (err) {
      console.error('Failed to persist published recipe:', err)
    }
  }

  const detailsTabContent = (<form className="store-form">
              <div className="form-grid">
                <label className="form-field">
                  <span className="field-label">Name</span>
                  <InputText
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
                        <RadioButton
                          name="meal"
                          value={option}
                          checked={recipe.meal === option}
                          onChange={(e) =>
                            setRecipe({ ...recipe, meal: e.value as Recipe["meal"] })
                          }
                        />
                        <span className="radio-dot" />
                        {option}
                      </label>
                    ))}
                  </div>
                  <span className="field-hint">Pick where this dish fits best.</span>
                </div>

                <div className="form-field form-field-full">
                  <span className="field-label">Description</span>
                  <Editor
                    className="recipe-editor"
                    value={recipe.description}
                    onTextChange={(e) => setRecipe({ ...recipe, description: e.htmlValue ?? '' })}
                    placeholder="Describe flavors, prep time, or serving ideas."
                    style={{ height: '160px' }}
                    aria-label="Recipe description"
                  />
                  <span className="field-hint">Keep it short—add detailed steps later.</span>
                </div>

                <label className="form-field">
                  <span className="field-label">Serves</span>
                  <InputNumber
                    className="serves-input"
                    min={1}
                    value={recipe.serves ?? null}
                    onValueChange={(e) => setRecipe({ ...recipe, serves: e.value ?? null })}
                    placeholder="e.g. 4"
                    aria-label="Serves"
                  />
                  <span className="field-hint">How many portions does this recipe make?</span>
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
        <h3 className="ingredients-heading form-field-full">Ingredients</h3>
        {ingredientCount === 0 && <p className="no-ingredients-text">No ingredients added yet.</p>}
        
        <IngredientInput onAdd={handleAddIngredient} />
        {ingredientCount > 0 && recipe.ingredients?.map((ingredient, index) => (
          <IngredientInput storedIngredient={ingredient} key={ingredientRowIds[index] ?? index} onChange={(updated) => handleUpdateIngredient(index, updated)} onRemove={() => handleRemoveIngredient(index)} />
        ))}
        
        {similarRecipe && (
          <div className="similar-recipe-suggestion" role="alert">
            <span className="suggestion-icon">💡</span>
            <span className="suggestion-text">
              Similar recipe found: <Link href={toRecipeUrl(similarRecipe.recipe.shortId, similarRecipe.recipe.name)} className="suggestion-link">{similarRecipe.recipe.name}</Link> ({Math.round(similarRecipe.similarity * 100)}% ingredient match)
            </span>
          </div>
        )}
      </div>
    </form>
  )
  let panelContent: React.ReactNode
  if (inputMode === 'guided') {
    panelContent = activeTab === "details" ? detailsTabContent : ingredientsTabContent
  } else if (inputMode === 'markdown') {
    panelContent = <MarkdownImport />
  } else if (inputMode === 'import') {
    panelContent = <RecipeImporter />
  }
  
  return (
    <div className="recipe-store">
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
            <Tag rounded value="Draft" />
            <Tag rounded className="tag-ghost" value={`${ingredientCount} ${ingredientCount === 1 ? "ingredient" : "ingredients"}`} />
          </div>
        </header>

        <section className="store-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              {inputMode === 'guided' && (
                <>
                  <span className={`tab ${activeTab === "details" ? "is-active" : ""}`} onClick={() => setActiveTab("details")} role="button" aria-label="Details Tab" aria-selected={activeTab === "details"}>Details</span>
                  <span className={`tab ${activeTab === "ingredients" ? "is-active" : ""}`} onClick={() => setActiveTab("ingredients")} role="button" aria-label="Ingredients Tab" aria-selected={activeTab === "ingredients"}>Ingredients</span>
                </>
              )}
            </div>
            <div className="toolbar-mode-toggle">
              <span
                className={`tab ${inputMode === 'guided' ? 'is-active' : ''}`}
                onClick={() => setInputMode('guided')}
                role="button"
                aria-label="Guided mode"
                aria-selected={inputMode === 'guided'}
              >
                Guided
              </span>
              <span
                className={`tab ${inputMode === 'import' ? 'is-active' : ''}`}
                onClick={() => setInputMode('import')}
                role="button"
                aria-label="Import mode"
                aria-selected={inputMode === 'import'}
              >
                Import
              </span>
              <span
                className={`tab ${inputMode === 'markdown' ? 'is-active' : ''}`}
                onClick={() => setInputMode('markdown')}
                role="button"
                aria-label="Advanced mode"
                aria-selected={inputMode === 'markdown'}
              >
                Advanced
              </span>
            </div>
          </div>

          <div className="panel-content">
            { panelContent}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Store
