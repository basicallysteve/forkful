import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFoodStore } from '@/stores/food'
import { useRecipeStore } from '@/stores/recipes'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import './foods.scss'

type SortOption = 'name' | 'calories' | 'protein'
type SortDirection = 'asc' | 'desc'

export default function Foods() {
  const foods = useFoodStore((state) => state.foods)
  const deleteFood = useFoodStore((state) => state.deleteFood)
  const isFoodUsedInRecipe = useFoodStore((state) => state.isFoodUsedInRecipe)
  const recipes = useRecipeStore((state) => state.recipes)
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filteredAndSortedFoods = useMemo(() => {
    let filtered = foods
    if (searchTerm) {
      filtered = filtered.filter(
        (food) =>
          food.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          food.measurements?.some((m) => m.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    return filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'calories':
          comparison = a.calories - b.calories
          break
        case 'protein':
          comparison = (a.protein || 0) - (b.protein || 0)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [foods, sortBy, sortDirection, searchTerm])

  function handleSelectFood(foodId: number) {
    const newSelected = new Set(selectedFoods)
    if (newSelected.has(foodId)) {
      newSelected.delete(foodId)
    } else {
      newSelected.add(foodId)
    }
    setSelectedFoods(newSelected)
    setDeleteError(null)
  }

  function handleSelectAll() {
    if (selectedFoods.size === filteredAndSortedFoods.length) {
      setSelectedFoods(new Set())
    } else {
      setSelectedFoods(new Set(filteredAndSortedFoods.map((f) => f.id)))
    }
    setDeleteError(null)
  }

  function handleDeleteSelected() {
    if (selectedFoods.size === 0) return
    setDeleteError(null)

    const foodsInUse: string[] = []
    const foodsToDelete: number[] = []

    selectedFoods.forEach((id) => {
      const food = foods.find((f) => f.id === id)
      if (food && isFoodUsedInRecipe(id, recipes)) {
        foodsInUse.push(food.name)
      } else {
        foodsToDelete.push(id)
      }
    })

    // Delete foods that are not in use
    foodsToDelete.forEach((id) => deleteFood(id, recipes))

    // Show error for foods that couldn't be deleted
    if (foodsInUse.length > 0) {
      setDeleteError(
        `Cannot delete "${foodsInUse.join('", "')}" because ${
          foodsInUse.length === 1 ? "it's" : "they're"
        } used in recipes.`
      )
    }

    // Clear selection for successfully deleted items
    const newSelected = new Set(selectedFoods)
    foodsToDelete.forEach((id) => newSelected.delete(id))
    setSelectedFoods(newSelected)
  }

  function formatMacros(food: Food): string {
    const parts: string[] = []
    if (food.protein) parts.push(`P: ${food.protein}g`)
    if (food.carbs) parts.push(`C: ${food.carbs}g`)
    if (food.fat) parts.push(`F: ${food.fat}g`)
    return parts.length > 0 ? parts.join(' | ') : '-'
  }

  return (
    <div className="foods-list">
      <div className="foods-titlebar" aria-hidden="true">
        <span className="title">Forkful — All Foods</span>
      </div>

      <div className="foods-content">
        <header className="foods-header">
          <div>
            <p className="foods-label">Browse</p>
            <h2 className="foods-name">All Foods</h2>
          </div>
          <div className="foods-meta">
            <span className="pill pill-primary">{foods.length} foods</span>
            {selectedFoods.size > 0 && (
              <span className="pill pill-ghost">{selectedFoods.size} selected</span>
            )}
          </div>
        </header>

        <section className="foods-panel">
          <div className="panel-toolbar">
            <div className="toolbar-filters">
              <label className="filter-group">
                <span className="filter-label">Search:</span>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search foods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>

              <label className="filter-group">
                <span className="filter-label">Sort by:</span>
                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="name">Name</option>
                  <option value="calories">Calories</option>
                  <option value="protein">Protein</option>
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
              <Link to="/foods/new" className="primary-button">
                + Add Food
              </Link>
              {selectedFoods.size > 0 && (
                <button type="button" className="danger-button" onClick={handleDeleteSelected}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {deleteError && (
            <div className="delete-error" role="alert">
              {deleteError}
            </div>
          )}

          <div className="panel-content">
            {filteredAndSortedFoods.length === 0 ? (
              <p className="no-foods-text">
                No foods found. Start by adding a new food item!
              </p>
            ) : (
              <>
                <div className="select-all-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="food-checkbox"
                      checked={
                        selectedFoods.size === filteredAndSortedFoods.length &&
                        filteredAndSortedFoods.length > 0
                      }
                      onChange={handleSelectAll}
                    />
                    <span className="checkbox-text">Select all</span>
                  </label>
                </div>
                <div className="food-cards">
                  {filteredAndSortedFoods.map((food) => (
                    <div
                      key={food.id}
                      className={`food-card ${selectedFoods.has(food.id) ? 'is-selected' : ''} ${
                        isFoodUsedInRecipe(food.id, recipes) ? 'is-used' : ''
                      }`}
                    >
                      <div className="card-checkbox">
                        <input
                          type="checkbox"
                          className="food-checkbox"
                          checked={selectedFoods.has(food.id)}
                          onChange={() => handleSelectFood(food.id)}
                          aria-label={`Select ${food.name}`}
                        />
                      </div>
                      <Link to={`/foods/${toSlug(food.name)}`} className="card-content">
                        <div className="card-header">
                          <h3 className="card-title">{food.name}</h3>
                          <div className="card-badges">
                            <span className="pill pill-ghost">{food.calories} cal</span>
                            {isFoodUsedInRecipe(food.id, recipes) && (
                              <span className="pill pill-info">In use</span>
                            )}
                          </div>
                        </div>
                        <p className="card-macros">{formatMacros(food)}</p>
                        <div className="card-footer">
                          <span className="card-meta">
                            {food.servingSize} {food.servingUnit} per serving
                          </span>
                          {food.measurements && food.measurements.length > 0 && (
                            <span className="card-meta">
                              {food.measurements.slice(0, 3).join(', ')}
                              {food.measurements.length > 3 && '...'}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
