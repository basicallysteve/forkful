'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Card } from 'primereact/card'
import { Skeleton } from 'primereact/skeleton'
import { useFoodStore } from '@/stores/food'
import { useRecipeStore } from '@/stores/recipes'
import { apiDeleteFood, apiFetchFoods } from '@/lib/api/foods'
import type { Food } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Checkbox } from 'primereact/checkbox'
import OpenFoodFactsImport from '@/components/OpenFoodFactsImport/OpenFoodFactsImport'

type SortOption = 'name' | 'calories' | 'protein'
type SortDirection = 'asc' | 'desc'

export default function Foods() {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)
  const addFood = useFoodStore((state) => state.addFood)
  const deleteFood = useFoodStore((state) => state.deleteFood)
  const isFoodUsedInRecipe = useFoodStore((state) => state.isFoodUsedInRecipe)
  const recipes = useRecipeStore((state) => state.recipes)
  // true when store is pre-populated (e.g. back-navigation) — skips redundant fetch
  const [hasFetched, setHasFetched] = useState(foods.length > 0)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [selectedFoods, setSelectedFoods] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  useEffect(() => {
    if (hasFetched) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) setShowSkeleton(true)
    }, 150)

    apiFetchFoods()
      .then((data) => {
        if (!cancelled) {
          setFoods(data)
          setHasFetched(true)
          setShowSkeleton(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowSkeleton(false)
          setHasFetched(true)
        }
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [hasFetched, setFoods, setHasFetched, setShowSkeleton])

  const filteredAndSortedFoods = useMemo(() => {
    let filtered = foods
    if (searchTerm) {
      filtered = filtered.filter(
        (food) =>
          food.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          food.measurements?.some((m) => m.unit.toLowerCase().includes(searchTerm.toLowerCase()))
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

  async function handleDeleteSelected() {
    if (selectedFoods.size === 0) return
    setDeleteError(null)

    const foodsInUse: string[] = []
    const foodsToDelete: Food[] = []

    selectedFoods.forEach((id) => {
      const food = foods.find((f) => f.id === id)
      if (food && isFoodUsedInRecipe(id, recipes)) {
        foodsInUse.push(food.name)
      } else if (food) {
        foodsToDelete.push(food)
      }
    })

    foodsToDelete.forEach(food => deleteFood(food.id))
    try {
      await Promise.all(foodsToDelete.map(food => apiDeleteFood(toSlug(food.name))))
    } catch (err) { console.error('Failed to delete foods from server:', err) }

    if (foodsInUse.length > 0) {
      setDeleteError(
        `Cannot delete "${foodsInUse.join('", "')}" because ${
          foodsInUse.length === 1 ? "it's" : "they're"
        } used in recipes.`
      )
    }

    const newSelected = new Set(selectedFoods)
    foodsToDelete.forEach((food) => newSelected.delete(food.id))
    setSelectedFoods(newSelected)
  }

  function formatMacros(food: Food): string {
    const parts: string[] = []
    if (food.protein) parts.push(`P: ${food.protein}g`)
    if (food.carbs) parts.push(`C: ${food.carbs}g`)
    if (food.fat) parts.push(`F: ${food.fat}g`)
    return parts.length > 0 ? parts.join(' | ') : '-'
  }

  if (!hasFetched) {
    if (!showSkeleton) return null
    return (
      <div className="foods-list">
        <div className="foods-content">
          <header className="foods-header">
            <div>
              <Skeleton width="4rem" height="1rem" className="mb-2" />
              <Skeleton width="6rem" height="1.5rem" />
            </div>
          </header>
          <section className="foods-panel">
            <div className="panel-content">
              <div className="food-cards">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height="8rem" borderRadius="8px" />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="foods-list">
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
                <InputText
                  className="filter-input"
                  placeholder="Search foods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>

              <label className="filter-group">
                <span className="filter-label">Sort by:</span>
                <Dropdown
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.value as SortOption)}
                  options={[
                    { label: 'Name', value: 'name' },
                    { label: 'Calories', value: 'calories' },
                    { label: 'Protein', value: 'protein' },
                  ]}
                  ariaLabel="Sort by"
                />
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
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowImportDialog(true)}
              >
                Import Food
              </button>
              <Link href="/foods/new" className="primary-button">
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
                    <Checkbox
                      className="food-checkbox"
                      checked={
                        selectedFoods.size === filteredAndSortedFoods.length &&
                        filteredAndSortedFoods.length > 0
                      }
                      onChange={handleSelectAll}
                      aria-label="Select all"
                    />
                    <span className="checkbox-text">Select all</span>
                  </label>
                </div>
                <div className="food-cards">
                  {filteredAndSortedFoods.map((food) => (
                    <Card
                      key={food.id}
                      className={`food-card ${selectedFoods.has(food.id) ? 'is-selected' : ''} ${
                        isFoodUsedInRecipe(food.id, recipes) ? 'is-used' : ''
                      }`}
                    >
                      <div className="card-checkbox">
                        <Checkbox
                          className="food-checkbox"
                          checked={selectedFoods.has(food.id)}
                          onChange={() => handleSelectFood(food.id)}
                          aria-label={`Select ${food.name}`}
                        />
                      </div>
                      <Link href={`/foods/${toSlug(food.name)}`} className="card-content">
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
                              {food.measurements.slice(0, 3).map((m) => m.unit).join(', ')}
                              {food.measurements.length > 3 && '...'}
                            </span>
                          )}
                        </div>
                      </Link>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <OpenFoodFactsImport
        visible={showImportDialog}
        onHide={() => setShowImportDialog(false)}
        onImport={addFood}
      />
    </div>
  )
}
