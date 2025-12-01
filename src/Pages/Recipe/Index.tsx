import './recipe.scss'
import { type Recipe } from '@/types/Recipe'


export default function Recipe({ recipe }: { recipe: Recipe }) {
  let xDaysOld = 0
  if (recipe.date_added) {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - recipe.date_added.getTime())
    xDaysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  let daysOldText = xDaysOld > 0 ? `${xDaysOld} days old` : "New"

  let totalCalories = recipe.ingredients.reduce((total, ingredient) => {
    return total + (ingredient.calories || 0)
  }, 0)

  return (
    <div className="recipe-view">
      <div className="recipe-titlebar" aria-hidden="true">
        <span className="title">Cookbook — {recipe.name}</span>
      </div>

      <div className="recipe-content">
        <header className="recipe-header">
          <div>
            <p className="recipe-label">Recipe</p>
            <h2 className="recipe-name">{recipe.name}</h2>
          </div>
          <div className="recipe-meta">
            <span className="pill pill-primary">{daysOldText}</span>
            <span className="pill pill-ghost">
              {recipe.ingredients.length} ingredients
            </span>
          </div>
        </header>

        <p className="recipe-description">{recipe.description}</p>

        <section className="recipe-panel">
          <div className="panel-toolbar">
            <div className="toolbar-tabs">
              <span className="tab is-active">{recipe.meal}</span>
              <span className="tab">{totalCalories} calories</span>
            </div>
            {/* TODO: Return to actions later */}
            {/* <div className="toolbar-actions">
      
            </div> */}
          </div>

          <div className="panel-content">
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="quantity-col">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ingredient, index) => (
                  <tr key={`${ingredient.name}-${index}`}>
                    <td>{ingredient.name}</td>
                    <td className="quantity-col">{ingredient.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
