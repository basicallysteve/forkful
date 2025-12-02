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
  { recipes = mockRecipes, setRecipes = vi.fn(), existingIngredients = [] }: { recipes?: RecipeType[]; setRecipes?: (recipes: RecipeType[]) => void; existingIngredients?: { name: string; quantity: number; calories?: number }[] } = {}
) {
  const contextValue: RecipeContextType = {
    recipes,
    setRecipes,
    existingIngredients,
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

      const ingredientInput = screen.getByLabelText('Ingredient 1 name')
      await user.clear(ingredientInput)
      await user.type(ingredientInput, 'Turkey')

      expect(ingredientInput).toHaveValue('Turkey')
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

    it('updates calories when quantity changes for existing ingredient', async () => {
      const user = userEvent.setup()
      // Provide existing ingredients with per-unit calories (75 calories per unit for Ham)
      const existingIngredients = [
        { name: 'Ham', quantity: 1, calories: 75 },
        { name: 'Cheese', quantity: 1, calories: 100 },
      ]
      renderWithProviders(<Recipe recipe={mockRecipe} />, { existingIngredients })

      await user.click(screen.getByRole('button', { name: /edit/i }))

      // Initial calories should be 250 (150 + 100)
      expect(screen.getByText('250 calories')).toBeInTheDocument()

      // Change Ham quantity from 2 to 4
      const quantityInputs = screen.getAllByRole('spinbutton', { name: /ingredient \d+ quantity/i })
      await user.clear(quantityInputs[0])
      await user.type(quantityInputs[0], '4')

      // Calories should update: Ham (4 * 75 = 300) + Cheese (100) = 400
      expect(screen.getByText('400 calories')).toBeInTheDocument()
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

      // After removing Ham, only Cheese should remain
      expect(screen.queryByLabelText('Ingredient 1 name')).toHaveValue('Cheese')
      expect(screen.queryByLabelText('Ingredient 2 name')).not.toBeInTheDocument()
    })

    it('displays Add Ingredient button in edit mode', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByRole('button', { name: /add ingredient/i })).toBeInTheDocument()
    })

    it('adds an existing ingredient and requires calories before adding a new ingredient', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      const existingIngredients = [
        { name: 'Tomato', quantity: 1, calories: 25 },
        { name: 'Lettuce', quantity: 1, calories: 5 },
      ]
      renderWithProviders(<Recipe recipe={mockRecipe} />, { existingIngredients, setRecipes })

      await user.click(screen.getByRole('button', { name: /edit/i }))

      // Add and select an existing ingredient (should update calories)
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))
      const existingIngredientInput = screen.getByLabelText('Ingredient 3 name')
      await user.type(existingIngredientInput, 'Tomato')

      // Calories should include the existing ingredient's per-unit calories (250 + 25 = 275)
      expect(await screen.findByText('275 calories')).toBeInTheDocument()

      // Add a brand new ingredient name without entering calories
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))
      const newIngredientInput = screen.getByLabelText('Ingredient 4 name')
      await user.type(newIngredientInput, 'Pickles')

      // Cannot add another ingredient while calories are missing
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))
      expect(screen.queryByLabelText('Ingredient 5 name')).not.toBeInTheDocument()

      // Saving should ignore the ingredient that has no calories
      await user.click(screen.getByRole('button', { name: /save/i }))
      expect(setRecipes).toHaveBeenCalledTimes(1)
      const updatedRecipes = setRecipes.mock.calls[0][0] as RecipeType[]
      const updatedRecipe = updatedRecipes.find(r => r.id === mockRecipe.id)
      expect(updatedRecipe?.ingredients.some(ing => ing.name === 'Tomato')).toBe(true)
      expect(updatedRecipe?.ingredients.some(ing => ing.name === 'Pickles')).toBe(false)
    })

    it('does not add duplicate empty ingredient', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipe recipe={mockRecipe} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))
      await user.click(screen.getByRole('button', { name: /add ingredient/i }))

      // Still should be 3, not 4 (don't add duplicate empty)
      expect(screen.getByLabelText('Ingredient 1 name')).toBeInTheDocument()
      expect(screen.getByLabelText('Ingredient 2 name')).toBeInTheDocument()
      expect(screen.getByLabelText('Ingredient 3 name')).toBeInTheDocument()
      expect(screen.queryByLabelText('Ingredient 4 name')).not.toBeInTheDocument()
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

  describe('canEdit Prop', () => {
    it('hides Edit button when canEdit is false', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} canEdit={false} />)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })

    it('shows Edit button when canEdit is true (default)', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('does not enter edit mode with isEditing=true when canEdit is false', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} isEditing={true} canEdit={false} />)
      expect(screen.queryByRole('textbox', { name: /recipe name/i })).not.toBeInTheDocument()
    })

    it('still shows Copy Recipe button when canEdit is false', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} canEdit={false} />)
      expect(screen.getByRole('button', { name: /copy recipe/i })).toBeInTheDocument()
    })
  })

  describe('Published Date Display', () => {
    it('displays published date text for published recipes', () => {
      renderWithProviders(<Recipe recipe={mockRecipe} />)
      expect(screen.getByText(/published/i)).toBeInTheDocument()
    })

    it('displays Unpublished for recipes without date_published', () => {
      const unpublishedRecipe = { ...mockRecipe, date_published: null }
      renderWithProviders(<Recipe recipe={unpublishedRecipe} />)
      expect(screen.getByText('Unpublished')).toBeInTheDocument()
    })
  })

  describe('Publishing / Unpublishing', () => {
    it('publishes the recipe and sets date_published when Publish is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      const unpublishedRecipe = { ...mockRecipe, date_published: null }

      renderWithProviders(<Recipe recipe={unpublishedRecipe} />, { setRecipes })

      await user.click(screen.getByRole('button', { name: /publish/i }))

      expect(setRecipes).toHaveBeenCalledTimes(1)
      const updatedRecipes = setRecipes.mock.calls[0][0] as RecipeType[]
      const updatedRecipe = updatedRecipes.find(r => r.id === unpublishedRecipe.id)
      expect(updatedRecipe?.date_published).toBeInstanceOf(Date)
    })

    it('unpublishes the recipe when Unpublish is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()

      renderWithProviders(<Recipe recipe={mockRecipe} />, { setRecipes })

      await user.click(screen.getByRole('button', { name: /unpublish/i }))

      expect(setRecipes).toHaveBeenCalledTimes(1)
      const updatedRecipes = setRecipes.mock.calls[0][0] as RecipeType[]
      const updatedRecipe = updatedRecipes.find(r => r.id === mockRecipe.id)
      expect(updatedRecipe?.date_published).toBeNull()
    })
  })
})
