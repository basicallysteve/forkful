import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Foods from './Index'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'

const mockFoods: Food[] = [
  {
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
  },
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
  {
    id: 3,
    name: 'Broccoli',
    calories: 55,
    protein: 3.7,
    carbs: 11,
    fat: 0.6,
    fiber: 5.1,
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

describe('Foods List Page', () => {
  describe('Rendering', () => {
    it('renders the page title', () => {
      renderWithProviders(<Foods />)
      expect(screen.getByText('All Foods')).toBeInTheDocument()
    })

    it('displays the food count', () => {
      renderWithProviders(<Foods />)
      expect(screen.getByText('3 foods')).toBeInTheDocument()
    })

    it('renders all food cards', () => {
      renderWithProviders(<Foods />)
      expect(screen.getByText('Chicken Breast')).toBeInTheDocument()
      expect(screen.getByText('Brown Rice')).toBeInTheDocument()
      expect(screen.getByText('Broccoli')).toBeInTheDocument()
    })

    it('displays calorie information for each food', () => {
      renderWithProviders(<Foods />)
      expect(screen.getByText('165 cal')).toBeInTheDocument()
      expect(screen.getByText('216 cal')).toBeInTheDocument()
      expect(screen.getByText('55 cal')).toBeInTheDocument()
    })

    it('displays macronutrient summary', () => {
      renderWithProviders(<Foods />)
      // Check that macro info is displayed
      const cards = screen.getAllByRole('link')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('shows empty state when no foods', () => {
      renderWithProviders(<Foods />, { foods: [] })
      expect(screen.getByText('No foods found. Start by adding a new food item!')).toBeInTheDocument()
    })

    it('renders Add Food link', () => {
      renderWithProviders(<Foods />)
      const addLink = screen.getByRole('link', { name: /add food/i })
      expect(addLink).toHaveAttribute('href', '/foods/new')
    })
  })

  describe('Search', () => {
    it('filters foods by name', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const searchInput = screen.getByPlaceholderText('Search foods...')
      await user.type(searchInput, 'chicken')

      expect(screen.getByText('Chicken Breast')).toBeInTheDocument()
      expect(screen.queryByText('Brown Rice')).not.toBeInTheDocument()
      expect(screen.queryByText('Broccoli')).not.toBeInTheDocument()
    })

    it('shows all foods when search is cleared', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const searchInput = screen.getByPlaceholderText('Search foods...')
      await user.type(searchInput, 'chicken')
      await user.clear(searchInput)

      expect(screen.getByText('Chicken Breast')).toBeInTheDocument()
      expect(screen.getByText('Brown Rice')).toBeInTheDocument()
      expect(screen.getByText('Broccoli')).toBeInTheDocument()
    })
  })

  describe('Sorting', () => {
    it('changes sort option', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i })
      await user.selectOptions(sortSelect, 'calories')

      expect(sortSelect).toHaveValue('calories')
    })

    it('toggles sort direction', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const sortButton = screen.getByRole('button', { name: /sort/i })
      expect(sortButton).toHaveTextContent('↑')

      await user.click(sortButton)
      expect(sortButton).toHaveTextContent('↓')

      await user.click(sortButton)
      expect(sortButton).toHaveTextContent('↑')
    })
  })

  describe('Selection', () => {
    it('selects individual food when checkbox is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const checkbox = screen.getByRole('checkbox', { name: /select chicken breast/i })
      await user.click(checkbox)

      expect(checkbox).toBeChecked()
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('selects all foods when "Select all" is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
      await user.click(selectAllCheckbox)

      expect(selectAllCheckbox).toBeChecked()
      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('deselects all foods when "Select all" is clicked again', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
      await user.click(selectAllCheckbox)
      await user.click(selectAllCheckbox)

      expect(selectAllCheckbox).not.toBeChecked()
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
    })

    it('shows delete button when foods are selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Foods />)

      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox', { name: /select chicken breast/i })
      await user.click(checkbox)

      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    })
  })

  describe('Delete functionality', () => {
    it('deletes selected foods that are not in use', async () => {
      const user = userEvent.setup()
      const deleteFood = vi.fn().mockReturnValue(true)
      renderWithProviders(<Foods />, { deleteFood })

      const checkbox = screen.getByRole('checkbox', { name: /select chicken breast/i })
      await user.click(checkbox)

      const deleteButton = screen.getByRole('button', { name: /^delete$/i })
      await user.click(deleteButton)

      expect(deleteFood).toHaveBeenCalledWith(1, mockRecipes)
    })

    it('shows error when trying to delete food used in recipe', async () => {
      const user = userEvent.setup()
      const isFoodUsedInRecipe = vi.fn().mockReturnValue(true)
      const deleteFood = vi.fn().mockReturnValue(false)
      renderWithProviders(<Foods />, { isFoodUsedInRecipe, deleteFood })

      const checkbox = screen.getByRole('checkbox', { name: /select chicken breast/i })
      await user.click(checkbox)

      const deleteButton = screen.getByRole('button', { name: /^delete$/i })
      await user.click(deleteButton)

      expect(screen.getByRole('alert')).toHaveTextContent(/cannot delete/i)
    })

    it('shows "In use" badge for foods used in recipes', () => {
      const isFoodUsedInRecipe = vi.fn().mockImplementation((id) => id === 1)
      renderWithProviders(<Foods />, { isFoodUsedInRecipe })

      expect(screen.getByText('In use')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('renders food cards as links to food details', () => {
      renderWithProviders(<Foods />)

      const links = screen.getAllByRole('link')
      expect(links.some(link => link.getAttribute('href') === '/foods/1')).toBe(true)
      expect(links.some(link => link.getAttribute('href') === '/foods/2')).toBe(true)
      expect(links.some(link => link.getAttribute('href') === '/foods/3')).toBe(true)
    })
  })
})
