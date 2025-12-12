import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRecipeStore } from '@/stores/recipes'
import { usePantryStore } from '@/stores/pantry'
import type { Recipe } from '@/types/Recipe'
import { toSlug } from '@/utils/slug'
import { calculateRecipesReadiness } from '@/utils/recipeReadiness'
import './recipes.scss'

type SortOption = 'name' | 'date_added' | 'meal' | 'date_published' | 'readiness'
type SortDirection = 'asc' | 'desc'

export default function Recipes() {
  const recipes = useRecipeStore((state) => state.recipes)
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe)
  const updateRecipe = useRecipeStore((state) => state.updateRecipe)
  const pantryItems = usePantryStore((state) => state.items)
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set())
  const [filterMeal, setFilterMeal] = useState<Recipe['meal'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date_added')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const mealOptions: Array<Recipe['meal'] | 'all'> = ['all', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']

  // Calculate readiness for all recipes
  const readinessMap = useMemo(() => {
    return calculateRecipesReadiness(recipes, pantryItems)
  }, [recipes, pantryItems])

  const filteredAndSortedRecipes = useMemo(() => {
    let filtered = filterMeal === 'all'
      ? recipes
      : recipes.filter(recipe => recipe.meal === filterMeal)
    if(searchTerm) {
      filtered = filtered.filter(recipe =>
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.ingredients.some(ingredient => ingredient.food.name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }


    return filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date_added': {
          const dateA = a.date_added ? new Date(a.date_added).getTime() : 0
          const dateB = b.date_added ? new Date(b.date_added).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case 'date_published': {
          const dateA = a.date_published ? new Date(a.date_published).getTime() : 0
          const dateB = b.date_published ? new Date(b.date_published).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case 'meal':
          comparison = (a.meal || '').localeCompare(b.meal || '')
          break
        case 'readiness': {
          const readinessA = readinessMap.get(a.id)?.readinessScore ?? 0
          const readinessB = readinessMap.get(b.id)?.readinessScore ?? 0
          comparison = readinessA - readinessB
          break
        }
      }

      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [recipes, filterMeal, sortBy, sortDirection, searchTerm, readinessMap])

  function handleSelectRecipe(recipeId: number) {
    const newSelected = new Set(selectedRecipes)
    if (newSelected.has(recipeId)) {
      newSelected.delete(recipeId)
    } else {
      newSelected.add(recipeId)
    }
    setSelectedRecipes(newSelected)
  }

  function handleSelectAll() {
    if (selectedRecipes.size === filteredAndSortedRecipes.length) {
      setSelectedRecipes(new Set())
    } else {
      setSelectedRecipes(new Set(filteredAndSortedRecipes.map(r => r.id)))
    }
  }

  function handleDeleteSelected() {
    if (selectedRecipes.size === 0) return
    selectedRecipes.forEach((id) => deleteRecipe(id))
    setSelectedRecipes(new Set())
  }

  function handleUnpublishSelected() {
    if (selectedRecipes.size === 0) return
    recipes.forEach((recipe) => {
      if (selectedRecipes.has(recipe.id)) {
        updateRecipe({ ...recipe, date_published: null })
      }
    })
    setSelectedRecipes(new Set())
  }

  function getDaysOld(date?: Date|null): string {
    if (!date) return ''
    const now = new Date()
    const dateObj = new Date(date)
    const diffTime = Math.abs(now.getTime() - dateObj.getTime())
    const xDaysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return xDaysOld > 1 ? `${xDaysOld} days ago` : 'Today'
  }

  return (
    <div className="recipes-list">
      <div className="recipes-titlebar" aria-hidden="true">
        <span className="title">Forkful — All Recipes</span>
      </div>

      <div className="recipes-content">
        <header className="recipes-header">
          <div>
            <p className="recipes-label">Browse</p>
            <h2 className="recipes-name">All Recipes</h2>
          </div>
          <div className="recipes-meta">
            <span className="pill pill-primary">{recipes.length} recipes</span>
            {selectedRecipes.size > 0 && (
              <span className="pill pill-ghost">{selectedRecipes.size} selected</span>
            )}
          </div>
        </header>

        <section className="recipes-panel">
          <div className="panel-toolbar">
            <div className="toolbar-filters">
              <label className="filter-group">
                <span className="filter-label">Category:</span>
                <select
                  className="filter-select"
                  value={filterMeal}
                  onChange={(e) => setFilterMeal(e.target.value as Recipe['meal'] | 'all')}
                >
                  {mealOptions.map((option) => (
                    <option key={option || 'all'} value={option || 'all'}>
                      {option === 'all' ? 'All Categories' : option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-group">
                <span className="filter-label">Search:</span>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search recipes..."
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase()
                    setSearchTerm(searchTerm)
                  }}
                />
              </label>

              <label className="filter-group">
                <span className="filter-label">Sort by:</span>
                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="date_added">Recent</option>
                  <option value="date_published">Published Date</option>
                  <option value="name">Name</option>
                  <option value="meal">Category</option>
                  <option value="readiness">Readiness</option>
                </select>
              </label>
              
              <button
                type="button"
                className="sort-direction-button"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            <div className="toolbar-actions">
              {selectedRecipes.size > 0 && (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleUnpublishSelected}
                  >
                    Unpublish
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={handleDeleteSelected}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="panel-content">
            {filteredAndSortedRecipes.length === 0 ? (
              <p className="no-recipes-text">No recipes found. Start by adding a new recipe!</p>
            ) : (
              <>
                <div className="select-all-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="recipe-checkbox"
                      checked={selectedRecipes.size === filteredAndSortedRecipes.length && filteredAndSortedRecipes.length > 0}
                      onChange={handleSelectAll}
                    />
                    <span className="checkbox-text">Select all</span>
                  </label>
                </div>
                <div className="recipe-cards">
                  {filteredAndSortedRecipes.map((recipe) => {
                    const readiness = readinessMap.get(recipe.id)
                    return (
                      <div key={recipe.id} className={`recipe-card ${selectedRecipes.has(recipe.id) ? 'is-selected' : ''}`}>
                        <div className="card-checkbox">
                          <input
                            type="checkbox"
                            className="recipe-checkbox"
                            checked={selectedRecipes.has(recipe.id)}
                            onChange={() => handleSelectRecipe(recipe.id)}
                            aria-label={`Select ${recipe.name}`}
                          />
                        </div>
                        <Link to={`/recipes/${toSlug(recipe.name)}`} className="card-content">
                            <div className="card-header">
                              <h3 className="card-title">{recipe.name}</h3>
                              <div className="card-badges">
                                {recipe.meal && (
                                  <span className="pill pill-ghost">{recipe.meal}</span>
                                )}
                                {recipe.date_published === null && (
                                  <span className="pill pill-warning">Unpublished</span>
                                )}
                              </div>
                            </div>
                          <p className="card-description">{recipe.description}</p>
                          <div className="card-footer">
                            <span className="card-meta">{recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}</span>
                            {readiness && (
                              <span className="card-meta readiness-indicator">
                                {readiness.availableIngredients}/{readiness.totalIngredients} available
                                {readiness.partialIngredients > 0 && ` (${readiness.partialIngredients} partial)`}
                              </span>
                            )}
                            <span className="card-meta">{getDaysOld(recipe.date_published)}</span>
                          </div>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
