import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import FoodIndex from './Index'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'

const mockFood: Food = {
  id: 1,
  name: 'Chicken Breast',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  servingSize: 100,
  servingUnit: 'g',
  measurements: ['g', 'oz'],
}

const mockFoods: Food[] = [
  mockFood,
  {
    id: 2,
    name: 'Brown Rice',
    calories: 216,
    protein: 5,
    carbs: 45,
    fat: 1.8,
    fiber: 3.5,
    servingSize: 1,
    servingUnit: 'cup',
    measurements: ['cup', 'g'],
  },
]

const mockRecipes: Recipe[] = []

function renderWithProviders(
  ui: React.ReactElement,
  {
    foods = mockFoods,
    setFoods = vi.fn(),
    addFood = vi.fn(),
    updateFood = vi.fn(),
    deleteFood = vi.fn().mockReturnValue(true),
    isFoodUsedInRecipe = vi.fn().mockReturnValue(false),
    getFoodByName = vi.fn(),
    recipes = mockRecipes,
    setRecipes = vi.fn(),
    existingIngredients = [],
  }: Partial<FoodContextType> & Partial<RecipeContextType> = {}
) {
  const foodContextValue: FoodContextType = {
    foods,
    setFoods,
    addFood,
    updateFood,
    deleteFood,
    isFoodUsedInRecipe,
    getFoodByName,
  }

  const recipeContextValue: RecipeContextType = {
    recipes,
    setRecipes,
    existingIngredients,
  }

  return render(
    <BrowserRouter>
      <GlobalFoodContext.Provider value={foodContextValue}>
        <GlobalRecipeContext.Provider value={recipeContextValue}>
          {ui}
        </GlobalRecipeContext.Provider>
      </GlobalFoodContext.Provider>
    </BrowserRouter>
  )
}

describe('Food View Page', () => {
  describe('Rendering', () => {
    it('renders the food name', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      expect(screen.getByRole('heading', { name: 'Chicken Breast' })).toBeInTheDocument()
    })

    it('displays calories', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      expect(screen.getByText('165 calories')).toBeInTheDocument()
    })

    it('displays serving information', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      expect(screen.getByText('100 g per serving')).toBeInTheDocument()
    })

    it('displays macronutrient values', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      // Protein value
      const nutritionValues = document.querySelectorAll('.nutrition-value')
      const valueTexts = Array.from(nutritionValues).map(v => v.textContent?.trim())
      expect(valueTexts).toContain('31g') // Protein
      expect(valueTexts).toContain('3.6g') // Fat
      // 0g appears twice (carbs and fiber)
      const zeroGrams = valueTexts.filter(t => t === '0g')
      expect(zeroGrams.length).toBe(2)
    })

    it('displays available measurements', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      expect(screen.getByText('g')).toBeInTheDocument()
      expect(screen.getByText('oz')).toBeInTheDocument()
    })

    it('renders back link to all foods', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      const backLink = screen.getByRole('link', { name: /all foods/i })
      expect(backLink).toHaveAttribute('href', '/foods')
    })

    it('renders Edit link', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      const editLink = screen.getByRole('link', { name: /edit/i })
      expect(editLink).toHaveAttribute('href', '/foods/chicken-breast/edit')
    })
  })

  describe('Delete functionality', () => {
    it('renders Delete button', () => {
      renderWithProviders(<FoodIndex food={mockFood} />)
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('calls deleteFood when Delete button is clicked', async () => {
      const user = userEvent.setup()
      const deleteFood = vi.fn().mockReturnValue(true)
      renderWithProviders(<FoodIndex food={mockFood} />, { deleteFood })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      expect(deleteFood).toHaveBeenCalledWith(1, mockRecipes)
    })

    it('disables Delete button when food is used in recipe', () => {
      const isFoodUsedInRecipe = vi.fn().mockReturnValue(true)
      renderWithProviders(<FoodIndex food={mockFood} />, { isFoodUsedInRecipe })

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      expect(deleteButton).toBeDisabled()
    })

    it('shows "Used in recipes" badge when food is used', () => {
      const isFoodUsedInRecipe = vi.fn().mockReturnValue(true)
      renderWithProviders(<FoodIndex food={mockFood} />, { isFoodUsedInRecipe })

      expect(screen.getByText('Used in recipes')).toBeInTheDocument()
    })
  })
})
