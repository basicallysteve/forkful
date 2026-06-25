'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRecipeStore } from '@/stores/recipes'
import { apiDeleteRecipe, apiUpdateRecipe, apiFetchRecipes } from '@/lib/api/recipes'
import type { Recipe } from '@/types/Recipe'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Checkbox } from 'primereact/checkbox'
import { Toast } from 'primereact/toast'
import { Skeleton } from 'primereact/skeleton'
import RecipeCard from '@/components/RecipeCard/RecipeCard'
import Link from 'next/link'

type SortOption = 'name' | 'date_added' | 'meal' | 'date_published'
type SortDirection = 'asc' | 'desc'

interface RecipesProps {
  forYouRecipes?: Recipe[]
  dietaryRestrictions?: string[]
  isAuthenticated?: boolean
}

export default function Recipes({ forYouRecipes = [], dietaryRestrictions = [], isAuthenticated = false }: RecipesProps) {
  const storeRecipes = useRecipeStore((state) => state.recipes)
  const setRecipes = useRecipeStore((state) => state.setRecipes)
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe)
  const updateRecipe = useRecipeStore((state) => state.updateRecipe)
  const toast = useRef<Toast>(null)
  // true when store is pre-populated (e.g. back-navigation) — skips redundant fetch
  const [hasFetched, setHasFetched] = useState(storeRecipes.length > 0)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set())
  const [filterMeal, setFilterMeal] = useState<Recipe['meal'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date_added')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [applyDietaryFilter, setApplyDietaryFilter] = useState(true)
  const mealOptions: Array<Recipe['meal'] | 'all'> = ['all', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']

  useEffect(() => {
    if (hasFetched) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) setShowSkeleton(true)
    }, 150)

    apiFetchRecipes()
      .then((data) => {
        if (!cancelled) {
          setRecipes(data)
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
  }, [hasFetched, setRecipes, setHasFetched, setShowSkeleton])

  const forYouIds = useMemo(() => new Set(forYouRecipes.map((r) => r.id)), [forYouRecipes])
  const recipes = useMemo(() => storeRecipes.filter((r) => !forYouIds.has(r.id)), [storeRecipes, forYouIds])

  const filteredAndSortedRecipes = useMemo(() => {
    let filtered = filterMeal === 'all'
      ? recipes
      : recipes.filter(recipe => recipe.meal === filterMeal)
    if(searchTerm) {
      filtered = filtered.filter(recipe =>
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (applyDietaryFilter && dietaryRestrictions.length > 0) {
      filtered = filtered.filter(recipe => {
        const tags = recipe.dietaryTags ?? []
        if (tags.length === 0) return true
        return dietaryRestrictions.every(r => tags.includes(r))
      })
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
      }

      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [recipes, filterMeal, sortBy, sortDirection, searchTerm, applyDietaryFilter, dietaryRestrictions])

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

  async function handleDeleteSelected() {
    if (selectedRecipes.size === 0) return
    const toDelete = recipes.filter((recipe) => selectedRecipes.has(recipe.id))
    toDelete.forEach(recipe => deleteRecipe(recipe.id))
    setSelectedRecipes(new Set())
    try {
      await Promise.all(toDelete.map(recipe => apiDeleteRecipe(recipe.shortId)))
    } catch (err) {
      console.error('Failed to delete recipes from server:', err)
      try {
        const fresh = await apiFetchRecipes()
        setRecipes(fresh)
      } catch { /* keep optimistic state if refresh also fails */ }
      toast.current?.show({ severity: 'error', summary: 'Could not delete recipes', detail: 'You may not have permission to delete one or more of the selected recipes.', life: 4000 })
    }
  }

  async function handleUnpublishSelected() {
    if (selectedRecipes.size === 0) return
    const original = recipes.filter((recipe) => selectedRecipes.has(recipe.id))
    const toUpdate = original.map(recipe => ({ ...recipe, date_published: null }))
    toUpdate.forEach(recipe => updateRecipe(recipe))
    setSelectedRecipes(new Set())
    try {
      await Promise.all(toUpdate.map(recipe => apiUpdateRecipe(recipe)))
    } catch (err) {
      console.error('Failed to unpublish recipes on server:', err)
      original.forEach(recipe => updateRecipe(recipe))
      toast.current?.show({ severity: 'error', summary: 'Could not unpublish recipes', detail: 'You may not have permission to edit one or more of the selected recipes.', life: 4000 })
    }
  }

  if (!hasFetched) {
    if (!showSkeleton) return null
    return (
      <div className="recipes-list">
        <div className="recipes-content">
          <header className="recipes-header">
            <div>
              <Skeleton width="4rem" height="1rem" className="mb-2" />
              <Skeleton width="8rem" height="1.5rem" />
            </div>
          </header>
          <section className="recipes-panel">
            <div className="panel-content">
              <div className="recipe-cards">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height="12rem" borderRadius="8px" />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="recipes-list">
      <Toast ref={toast} position="bottom-right" />
      <div className="recipes-content">
        <header className="recipes-header">
          <div>
            <p className="recipes-label">Browse</p>
            <h2 className="recipes-name">All Recipes</h2>
          </div>
          <div className="recipes-meta">
            
            <span className="pill">{recipes.length} recipes</span>
            {selectedRecipes.size > 0 && (
              <span className="pill pill-ghost">{selectedRecipes.size} selected</span>
            )}

            { isAuthenticated && (
              <Link href="/recipes/new" className="pill pill-primary">
                Add New
              </Link>
            )}
          </div>
        </header>

        {forYouRecipes.length > 0 && (
          <section className="for-you-section">
            <h3 className="for-you-heading">For You</h3>
            <div className="recipe-cards">
              {forYouRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          </section>
        )}

        <section className="recipes-panel">
          <div className="panel-toolbar">
            <div className="toolbar-filters">
              <label className="filter-group">
                <span className="filter-label">Category:</span>
                <Dropdown
                  className="filter-select"
                  value={filterMeal}
                  onChange={(e) => setFilterMeal(e.value as Recipe['meal'] | 'all')}
                  options={mealOptions.map((option) => ({
                    label: option === 'all' ? 'All Categories' : option,
                    value: option || 'all',
                  }))}
                  ariaLabel="Category"
                />
              </label>

              <label className="filter-group">
                <span className="filter-label">Search:</span>
                <InputText
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
                <Dropdown
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.value as SortOption)}
                  options={[
                    { label: 'Recent', value: 'date_added' },
                    { label: 'Published Date', value: 'date_published' },
                    { label: 'Name', value: 'name' },
                    { label: 'Category', value: 'meal' },
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

              {dietaryRestrictions.length > 0 && (
                <label className="filter-group dietary-toggle">
                  <Checkbox
                    className="recipe-checkbox"
                    checked={applyDietaryFilter}
                    onChange={(e) => setApplyDietaryFilter(e.checked ?? true)}
                    inputId="dietary-filter-toggle"
                  />
                  <span className="filter-label">Apply dietary filters</span>
                </label>
              )}
            </div>
            <div className="toolbar-actions">
              {isAuthenticated && selectedRecipes.size > 0 && (
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
                {isAuthenticated && (
                  <div className="select-all-row">
                    <label className="checkbox-label">
                      <Checkbox
                        className="recipe-checkbox"
                        checked={selectedRecipes.size === filteredAndSortedRecipes.length && filteredAndSortedRecipes.length > 0}
                        onChange={handleSelectAll}
                        aria-label="Select all"
                      />
                      <span className="checkbox-text">Select all</span>
                    </label>
                  </div>
                )}
                <div className="recipe-cards">
                  {filteredAndSortedRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      selected={isAuthenticated ? selectedRecipes.has(recipe.id) : undefined}
                      onSelect={isAuthenticated ? handleSelectRecipe : undefined}
                    />
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
