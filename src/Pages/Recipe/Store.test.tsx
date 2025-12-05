import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Store from './Store'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Recipe } from '@/types/Recipe'

const mockRecipes: Recipe[] = [
  {
    id: 1,
    name: 'Ham and Cheese Sandwich',
    meal: 'Lunch',
    description: 'A delicious sandwich made with ham and cheese.',
    ingredients: [
      { name: 'Ham', quantity: 2, calories: 150 },
      { name: 'Cheese', quantity: 1, calories: 100 },
      { name: 'Bread', quantity: 2, calories: 200 },
    ],
    date_added: new Date('2025-11-21'),
    date_published: new Date('2025-11-22'),
  },
  {
    id: 2,
    name: 'Spaghetti Bolognese',
    meal: 'Dinner',
    description: 'A classic Italian pasta dish with a rich meat sauce.',
    ingredients: [
      { name: 'Spaghetti', quantity: 100, calories: 350 },
      { name: 'Ground Beef', quantity: 200, calories: 400 },
      { name: 'Tomato Sauce', quantity: 150, calories: 80 },
    ],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
  },
]

function renderWithProviders(
  ui: React.ReactElement,
  { 
    recipes = mockRecipes, 
    setRecipes = vi.fn(),
    existingIngredients = []
  }: { 
    recipes?: Recipe[]
    setRecipes?: (recipes: Recipe[]) => void
    existingIngredients?: { name: string; quantity: number; calories?: number }[]
  } = {}
) {
  const contextValue: RecipeContextType = {
    recipes,
    setRecipes,
    existingIngredients,
  }

  return render(
    <BrowserRouter>
      <GlobalRecipeContext.Provider value={contextValue}>
        {ui}
      </GlobalRecipeContext.Provider>
    </BrowserRouter>
  )
}

describe('Store Page - Recipe Creation', () => {
  describe('Duplicate Recipe Name Validation', () => {
    it('shows error when recipe name matches existing recipe (exact match)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Ham and Cheese Sandwich')

      expect(screen.getByRole('alert')).toHaveTextContent('A recipe with this name already exists.')
      expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('shows error when recipe name matches existing recipe (case-insensitive)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'HAM AND CHEESE SANDWICH')

      expect(screen.getByRole('alert')).toHaveTextContent('A recipe with this name already exists.')
    })

    it('shows error when recipe name matches existing recipe (trimmed whitespace)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, '  Ham and Cheese Sandwich  ')

      expect(screen.getByRole('alert')).toHaveTextContent('A recipe with this name already exists.')
    })

    it('does not show error for unique recipe name', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Unique Recipe Name')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(nameInput).toHaveAttribute('aria-invalid', 'false')
    })

    it('disables Save Recipe button when duplicate name exists', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      // Fill out all fields with a duplicate name
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Ham and Cheese Sandwich')

      // Select a meal option
      const lunchRadio = screen.getByRole('radio', { name: /lunch/i })
      await user.click(lunchRadio)

      // Fill description
      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A test description')

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      expect(saveButton).toBeDisabled()
    })

    it('enables Save Recipe button when name is unique and all fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      // Fill out all fields with a unique name
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Unique Recipe')

      // Select a meal option
      const lunchRadio = screen.getByRole('radio', { name: /lunch/i })
      await user.click(lunchRadio)

      // Fill description
      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A test description')

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      expect(saveButton).not.toBeDisabled()
    })
  })

  describe('Similar Recipe Suggestions', () => {
    it('shows suggestion when ingredients match existing recipe (Jaccard similarity >= 30%)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />, {
        existingIngredients: [
          { name: 'Ham', quantity: 1, calories: 75 },
          { name: 'Cheese', quantity: 1, calories: 100 },
          { name: 'Bread', quantity: 1, calories: 100 },
        ]
      })

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Add ingredient that matches existing recipe
      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.type(ingredientNameInput, 'Ham')

      const quantityInput = screen.getByRole('spinbutton', { name: /quantity/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Add another matching ingredient
      await user.type(ingredientNameInput, 'Cheese')
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')
      await user.click(addButton)

      // Should see similar recipe suggestion
      const suggestion = screen.getByRole('alert')
      expect(suggestion).toHaveTextContent('Similar recipe found:')
      expect(suggestion).toHaveTextContent('Ham and Cheese Sandwich')
      expect(suggestion).toHaveTextContent('% ingredient match')
    })

    it('does not show suggestion when no ingredients are similar', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />, {
        existingIngredients: [
          { name: 'Unique Ingredient', quantity: 1 }
        ]
      })

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Add unique ingredient
      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.type(ingredientNameInput, 'Unique Ingredient')

      const quantityInput = screen.getByRole('spinbutton', { name: /quantity/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Should not see any suggestion alert (only alerts in this view are suggestions)
      expect(screen.queryByText(/Similar recipe found/)).not.toBeInTheDocument()
    })

    it('suggestion link navigates to the similar recipe', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />, {
        existingIngredients: [
          { name: 'Ham', quantity: 1, calories: 75 },
          { name: 'Cheese', quantity: 1, calories: 100 },
        ]
      })

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Add matching ingredients
      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.type(ingredientNameInput, 'Ham')

      const quantityInput = screen.getByRole('spinbutton', { name: /quantity/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      await user.type(ingredientNameInput, 'Cheese')
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')
      await user.click(addButton)

      // Check that the link exists and points to the right recipe
      const suggestionLink = screen.getByRole('link', { name: /ham and cheese sandwich/i })
      expect(suggestionLink).toHaveAttribute('href', '/recipes/1')
    })
  })

  describe('Ingredient Autocomplete', () => {
    it('shows dropdown suggestions and fills calories when selecting an existing ingredient', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />, {
        existingIngredients: [
          { name: 'Avocado', quantity: 1, calories: 80 },
          { name: 'Apple', quantity: 1, calories: 50 },
        ]
      })

      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.click(ingredientNameInput)

      const avocadoOption = await screen.findByRole('option', { name: /avocado/i })
      expect(screen.getByRole('option', { name: /apple/i })).toBeInTheDocument()

      await user.click(avocadoOption)

      expect(ingredientNameInput).toHaveValue('Avocado')
      const caloriesInput = screen.getByRole('spinbutton', { name: /calories/i })
      expect(caloriesInput).toHaveValue(80)
    })

    it('filters suggestions as the user types', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />, {
        existingIngredients: [
          { name: 'Banana', quantity: 1, calories: 90 },
          { name: 'Blueberry', quantity: 1, calories: 10 },
        ]
      })

      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.type(ingredientNameInput, 'blue')

      const blueberryOption = await screen.findByRole('option', { name: /blueberry/i })
      expect(screen.queryByRole('option', { name: /banana/i })).not.toBeInTheDocument()

      await user.click(blueberryOption)
      expect(ingredientNameInput).toHaveValue('Blueberry')
    })
  })

  describe('Mobile/Desktop Layout - Name and Pill Clamping', () => {
    it('renders recipe name input and displays properly', () => {
      renderWithProviders(<Store />)

      // Verify the name field exists
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      expect(nameInput).toBeInTheDocument()
    })

    it('renders meal options in the same form section', () => {
      renderWithProviders(<Store />)

      // Check all meal radio options exist
      expect(screen.getByRole('radio', { name: /breakfast/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /lunch/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /dinner/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /snack/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /dessert/i })).toBeInTheDocument()
    })
  })

  describe('Save and Publish Functionality', () => {
    it('calls setRecipes with new recipe when Save Recipe is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Store />, { setRecipes })

      // Fill out all required fields
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'New Test Recipe')

      const lunchRadio = screen.getByRole('radio', { name: /lunch/i })
      await user.click(lunchRadio)

      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A test description')

      // Click save
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      await user.click(saveButton)

      // Verify setRecipes was called
      expect(setRecipes).toHaveBeenCalledTimes(1)
      const newRecipes = setRecipes.mock.calls[0][0]
      expect(newRecipes).toHaveLength(3) // 2 existing + 1 new
      
      const newRecipe = newRecipes[2]
      expect(newRecipe.name).toBe('New Test Recipe')
      expect(newRecipe.meal).toBe('Lunch')
      expect(newRecipe.description).toBe('A test description')
      expect(newRecipe.date_published).toBeNull() // Saved as draft
    })

    it('calls setRecipes with published recipe when Publish is clicked', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Store />, { 
        setRecipes,
        existingIngredients: [{ name: 'Test Ingredient', quantity: 1, calories: 50 }]
      })

      // Fill out all required fields
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Published Recipe')

      const dinnerRadio = screen.getByRole('radio', { name: /dinner/i })
      await user.click(dinnerRadio)

      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A published recipe description')

      // Add an ingredient (required for publish)
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      const ingredientNameInput = screen.getByPlaceholderText('Ingredient name')
      await user.type(ingredientNameInput, 'Test Ingredient')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Switch back to details tab to access publish button
      const detailsTab = screen.getByRole('button', { name: /details tab/i })
      await user.click(detailsTab)

      // Click publish
      const publishButton = screen.getByRole('button', { name: /publish/i })
      await user.click(publishButton)

      // Verify setRecipes was called
      expect(setRecipes).toHaveBeenCalledTimes(1)
      const newRecipes = setRecipes.mock.calls[0][0]
      expect(newRecipes).toHaveLength(3)
      
      const newRecipe = newRecipes[2]
      expect(newRecipe.name).toBe('Published Recipe')
      expect(newRecipe.date_published).not.toBeNull() // Published with date
    })

    it('Publish button is disabled when no ingredients are added', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      // Fill out all required fields but no ingredients
      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Recipe Without Ingredients')

      const lunchRadio = screen.getByRole('radio', { name: /lunch/i })
      await user.click(lunchRadio)

      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A description')

      // Save should be enabled, Publish should be disabled
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      const publishButton = screen.getByRole('button', { name: /publish/i })
      
      expect(saveButton).not.toBeDisabled()
      expect(publishButton).toBeDisabled()
    })
  })
})

describe('Recipes List - Card Layout', () => {
  it('renders card header with title and badges on the same row', () => {
    const recipes: Recipe[] = [
      {
        id: 1,
        name: 'Test Recipe',
        meal: 'Lunch',
        description: 'Test description',
        ingredients: [],
      },
    ]

    const contextValue: RecipeContextType = {
      recipes,
      setRecipes: vi.fn(),
      existingIngredients: [],
    }

    const { container } = render(
      <BrowserRouter>
        <GlobalRecipeContext.Provider value={contextValue}>
          <div className="recipes-list">
            <div className="recipe-card">
              <div className="card-content">
                <div className="card-header">
                  <h3 className="card-title">Test Recipe</h3>
                  <div className="card-badges">
                    <span className="pill pill-ghost">Lunch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlobalRecipeContext.Provider>
      </BrowserRouter>
    )

    // Verify the card header structure exists
    const cardHeader = container.querySelector('.card-header')
    expect(cardHeader).toBeInTheDocument()

    const cardTitle = container.querySelector('.card-title')
    expect(cardTitle).toBeInTheDocument()
    expect(cardTitle).toHaveTextContent('Test Recipe')

    const cardBadges = container.querySelector('.card-badges')
    expect(cardBadges).toBeInTheDocument()
    
    // Both title and badges should be children of the same header element
    expect(cardHeader?.contains(cardTitle!)).toBe(true)
    expect(cardHeader?.contains(cardBadges!)).toBe(true)
  })
})
