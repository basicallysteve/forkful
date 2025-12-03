import { useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import './food.scss'

interface FoodIndexProps {
  food: Food
}

export default function FoodIndex({ food }: FoodIndexProps) {
  const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext)
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)
  const navigate = useNavigate()

  if (!foodContext) {
    throw new Error('FoodProvider is missing')
  }

  if (!recipeContext) {
    throw new Error('RecipeProvider is missing')
  }

  const { deleteFood, isFoodUsedInRecipe } = foodContext
  const { recipes } = recipeContext

  const isUsedInRecipe = isFoodUsedInRecipe(food.id, recipes)

  function handleDelete() {
    if (isUsedInRecipe) return
    if (deleteFood(food.id, recipes)) {
      navigate('/foods')
    }
  }

  function formatMacros(): string {
    const parts: string[] = []
    if (food.protein !== undefined) parts.push(`Protein: ${food.protein}g`)
    if (food.carbs !== undefined) parts.push(`Carbs: ${food.carbs}g`)
    if (food.fat !== undefined) parts.push(`Fat: ${food.fat}g`)
    if (food.fiber !== undefined) parts.push(`Fiber: ${food.fiber}g`)
    return parts.length > 0 ? parts.join(' • ') : 'No macronutrient data'
  }

  return (
    <div className="food-view">
      <div className="food-titlebar" aria-hidden="true">
        <span className="title">Forkful — {food.name}</span>
      </div>

      <div className="food-content">
        <header className="food-header">
          <div className="food-header-container">
            <Link to="/foods" className="back-link">
              ← All Foods
            </Link>
            <p className="food-label">Food</p>
            <h2 className="food-name">{food.name}</h2>
          </div>
          <div className="food-meta">
            <span className="pill pill-primary">{food.calories} calories</span>
            {isUsedInRecipe && <span className="pill pill-info">Used in recipes</span>}
          </div>
        </header>

        <section className="food-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">
                {food.servingSize} {food.servingUnit} per serving
              </span>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
                disabled={isUsedInRecipe}
                title={
                  isUsedInRecipe
                    ? 'Cannot delete food that is used in recipes'
                    : 'Delete this food'
                }
              >
                Delete
              </button>
              <Link to={`/foods/${toSlug(food.name)}/edit`} className="primary-button">
                Edit
              </Link>
            </div>
          </div>

          <div className="panel-content">
            <div className="nutrition-section">
              <h3 className="section-title">Nutritional Information</h3>
              <div className="nutrition-grid">
                <div className="nutrition-item">
                  <span className="nutrition-label">Calories</span>
                  <span className="nutrition-value">{food.calories}</span>
                </div>
                <div className="nutrition-item">
                  <span className="nutrition-label">Protein</span>
                  <span className="nutrition-value">
                    {food.protein || 0}g
                  </span>
                </div>
                <div className="nutrition-item">
                  <span className="nutrition-label">Carbohydrates</span>
                  <span className="nutrition-value">
                    {food.carbs || 0}g
                  </span>
                </div>
                <div className="nutrition-item">
                  <span className="nutrition-label">Fat</span>
                  <span className="nutrition-value">{food.fat || 0}g</span>
                </div>
                <div className="nutrition-item">
                  <span className="nutrition-label">Fiber</span>
                  <span className="nutrition-value">
                    {food.fiber || 0}g
                  </span>
                </div>
              </div>
            </div>

            <div className="serving-section">
              <h3 className="section-title">Serving Information</h3>
              <p className="serving-info">
                <strong>Serving Size:</strong> {food.servingSize} {food.servingUnit}
              </p>
              {food.measurements && food.measurements.length > 0 && (
                <div className="measurements-info">
                  <strong>Available Measurements:</strong>
                  <div className="measurement-tags">
                    {food.measurements.map((m) => (
                      <span key={m} className="measurement-tag">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="macro-summary">{formatMacros()}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
