import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Recipe from './Index'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Recipe as RecipeType } from '@/types/Recipe'

const mockRecipe: RecipeType = {
  id: 1,
  name: 'Ham and Cheese Sandwich',
  meal: 'Lunch',
  description: 'A delicious sandwich made with ham and cheese.',
  ingredients: [
    { name: 'Ham', quantity: 2, calories: 150 },
    { name: 'Cheese', quantity: 1, calories: 100 },
  ],
  date_added: new Date('2025-11-21'),
  date_published: new Date('2025-11-22'),
}

const mockRecipes: RecipeType[] = [
  mockRecipe,
  {
    id: 2,
    name: 'Spaghetti Bolognese',
    meal: 'Dinner',
    description: 'A classic Italian pasta dish.',
    ingredients: [
      { name: 'Spaghetti', quantity: 100, calories: 350 },
    ],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
  },
]

function renderWithProviders(
  ui: React.ReactElement,
  { recipes = mockRecipes, setRecipes = vi.fn() }: { recipes?: RecipeType[]; setRecipes?: (recipes: RecipeType[]) => void } = {}
) {
  const contextValue: RecipeContextType = {
    recipes,
    setRecipes,
    existingIngredients: [],
  }

  return {
    ...render(
      <BrowserRouter>
        <GlobalRecipeContext.Provider value={contextValue}>
          {ui}
        </GlobalRecipeContext.Provider>
      </BrowserRouter>
    ),
    setRecipes,
  }
}

describe('Recipe View Page', () => {
  describe('Viewing Recipe', () => {
    it('renders the recipe name', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByRole('heading', { name: 'Ham and Cheese Sandwich' })).toBeInTheDocument()
    })

    it('renders the recipe description', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText('A delicious sandwich made with ham and cheese.')).toBeInTheDocument()
    })

    it('displays meal category', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText('Lunch')).toBeInTheDocument()
    })

    it('displays ingredient count', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText('2 ingredients')).toBeInTheDocument()
    })

    it('displays all ingredients in the table', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText('Ham')).toBeInTheDocument()
      expect(screen.getByText('Cheese')).toBeInTheDocument()
    })

    it('displays ingredient quantities', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      const table = screen.getByRole('table')
      expect(within(table).getByText('2')).toBeInTheDocument()
      expect(within(table).getByText('1')).toBeInTheDocument()
    })

    it('displays total calories', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText('250 calories')).toBeInTheDocument()
    })

    it('renders back link to all recipes', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      const backLink = screen.getByRole('link', { name: /all recipes/i })
      expect(backLink).toHaveAttribute('href', '/recipes')
    })

    it('displays Edit button in view mode', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('displays Copy Recipe button in view mode', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByRole('button', { name: /copy recipe/i })).toBeInTheDocument()
    })
  })

  describe('Editing Recipe', () => {
    it('enters edit mode when isEditing prop is true', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} isEditing={true} />)
      expect(screen.getByRole('textbox', { name: /recipe name/i })).toBeInTheDocument()
    })

    it('enters edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByRole('textbox', { name: /recipe name/i })).toBeInTheDocument()
    })

    it('displays name input with current recipe name in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const nameInput = screen.getByRole('textbox', { name: /recipe name/i })
      expect(nameInput).toHaveValue('Ham and Cheese Sandwich')
    })

    it('displays description textarea in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const descriptionInput = screen.getByRole('textbox', { name: /recipe description/i })
      expect(descriptionInput).toHaveValue('A delicious sandwich made with ham and cheese.')
    })

    it('displays meal select in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const mealSelect = screen.getByRole('combobox', { name: /meal type/i })
      expect(mealSelect).toHaveValue('Lunch')
    })

    it('displays Save and Cancel buttons in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('allows editing recipe name', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const nameInput = screen.getByRole('textbox', { name: /recipe name/i })
      await user.clear(nameInput)
      await user.type(nameInput, 'Turkey Sandwich')

      expect(nameInput).toHaveValue('Turkey Sandwich')
    })

    it('allows editing recipe description', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const descriptionInput = screen.getByRole('textbox', { name: /recipe description/i })
      await user.clear(descriptionInput)
      await user.type(descriptionInput, 'A new description')

      expect(descriptionInput).toHaveValue('A new description')
    })

    it('allows changing meal type', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const mealSelect = screen.getByRole('combobox', { name: /meal type/i })
      await user.selectOptions(mealSelect, 'Dinner')

      expect(mealSelect).toHaveValue('Dinner')
    })

    it('allows editing ingredient name', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const ingredientInput = screen.getAllByRole('textbox', { name: /ingredient \d+ name/i })[0]
      await user.clear(ingredientInput)
      await user.type(ingredientInput, 'Turkey')

      // Re-query the element after typing
      const updatedInput = screen.getAllByRole('textbox', { name: /ingredient \d+ name/i })[0]
      expect(updatedInput).toHaveValue('Turkey')
    })

    it('allows editing ingredient quantity', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const quantityInputs = screen.getAllByRole('spinbutton', { name: /ingredient \d+ quantity/i })
      await user.clear(quantityInputs[0])
      await user.type(quantityInputs[0], '5')

      expect(quantityInputs[0]).toHaveValue(5)
    })

    it('saves changes when Save button is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Recipe recipe={mockRecipe} />, { setRecipes })

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const nameInput = screen.getByRole('textbox', { name: /recipe name/i })
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Sandwich')

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(setRecipes).toHaveBeenCalledTimes(1)
      const updatedRecipes = setRecipes.mock.calls[0][0] as RecipeType[]
      expect(updatedRecipes.find(r => r.id === 1)?.name).toBe('Updated Sandwich')
    })

    it('exits edit mode after saving', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(screen.queryByRole('textbox', { name: /recipe name/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('cancels changes when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Recipe recipe={mockRecipe} />, { setRecipes })

      await user.click(screen.getByRole('button', { name: /edit/i }))

      const nameInput = screen.getByRole('textbox', { name: /recipe name/i })
      await user.clear(nameInput)
      await user.type(nameInput, 'Changed Name')

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(setRecipes).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: 'Ham and Cheese Sandwich' })).toBeInTheDocument()
    })

    it('exits edit mode after cancelling', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.queryByRole('textbox', { name: /recipe name/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })
  })

  describe('Managing Ingredients', () => {
    it('displays Remove button for each ingredient in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByRole('button', { name: /remove ham/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove cheese/i })).toBeInTheDocument()
    })

    it('removes ingredient when Remove button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /remove ham/i }))

      const ingredientInputs = screen.getAllByRole('textbox', { name: /ingredient \d+ name/i })
      expect(ingredientInputs).toHaveLength(1)
      expect(ingredientInputs[0]).toHaveValue('Cheese')
    })

    it('displays Add Ingredient button in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByRole('button', { name: /add ingredient/i })).toBeInTheDocument()
    })

    it('adds new ingredient when Add Ingredient button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))

      const ingredientInputs = screen.getAllByRole('textbox', { name: /ingredient \d+ name/i })
      expect(ingredientInputs).toHaveLength(3)
    })
  })

  describe('Copy Recipe Functionality', () => {
    it('displays Copy Recipe button', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByRole('button', { name: /copy recipe/i })).toBeInTheDocument()
    })

    it('logs message when Copy Recipe button is clicked (placeholder)', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'log')
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /copy recipe/i }))

      expect(consoleSpy).toHaveBeenCalledWith('Copy recipe clicked:', 'Ham and Cheese Sandwich')
      consoleSpy.mockRestore()
    })
  })
})
