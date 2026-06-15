'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFoodStore } from '@/stores/food'
import { useRecipeStore } from '@/stores/recipes'
import { apiDeleteFood } from '@/lib/api/foods'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'

interface FoodIndexProps {
  food: Food
}

export default function FoodIndex({ food }: FoodIndexProps) {
  const deleteFood = useFoodStore((state) => state.deleteFood)
  const isFoodUsedInRecipe = useFoodStore((state) => state.isFoodUsedInRecipe)
  const recipes = useRecipeStore((state) => state.recipes)
  const router = useRouter()
  const isUsedInRecipe = useMemo(() => isFoodUsedInRecipe(food.id, recipes), [food.id, recipes, isFoodUsedInRecipe])

  async function handleDelete() {
    if (isUsedInRecipe) return
    try {
      await apiDeleteFood(toSlug(food.name))
      deleteFood(food.id)
      router.push('/foods')
    } catch (err) {
      console.error('Failed to delete food from server:', err)
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
      <div className="food-content">
        <header className="food-header">
          <div className="food-header-container">
            <Link href="/foods" className="back-link">
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
              {food.source !== 'usda' && (
                <Link href={`/foods/${toSlug(food.name)}/edit`} className="primary-button">
                  Edit
                </Link>
              )}
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
                {food.saturatedFat != null && (
                  <div className="nutrition-item nutrition-item-sub">
                    <span className="nutrition-label">Saturated Fat</span>
                    <span className="nutrition-value">{food.saturatedFat}g</span>
                  </div>
                )}
                <div className="nutrition-item">
                  <span className="nutrition-label">Fiber</span>
                  <span className="nutrition-value">{food.fiber || 0}g</span>
                </div>
                {food.sugar != null && (
                  <div className="nutrition-item nutrition-item-sub">
                    <span className="nutrition-label">Sugar</span>
                    <span className="nutrition-value">{food.sugar}g</span>
                  </div>
                )}
                {food.sodium != null && (
                  <div className="nutrition-item">
                    <span className="nutrition-label">Sodium</span>
                    <span className="nutrition-value">{food.sodium}mg</span>
                  </div>
                )}
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
                      <span key={m.unit} className="measurement-tag">
                        {m.unit}{m.gramsPerUnit ? ` (${m.gramsPerUnit}g)` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="macro-summary">{formatMacros()}</p>

            {food.source === 'usda' && (
              <p className="off-attribution">
                Data from{' '}
                <a
                  href="https://fdc.nal.usda.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  USDA FoodData Central
                </a>
                . Public domain.
              </p>
            )}

            {food.source === 'open_food_facts' && (
              <p className="off-attribution">
                Data from{' '}
                <a
                  href="https://world.openfoodfacts.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Food Facts
                </a>
                , available under the{' '}
                <a
                  href="https://opendatacommons.org/licenses/odbl/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Database License
                </a>
                .
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
