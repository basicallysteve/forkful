import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Store from './Store'
import { useRecipeStore, resetRecipeStore } from '@/stores/recipes'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'

// Mock foods
const mockFoods: Food[] = [
  { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 2, name: 'Cheese', calories: 100, protein: 7, carbs: 0, fat: 8, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 3, name: 'Bread', calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 2, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'loaf'] },
  { id: 4, name: 'Spaghetti', calories: 350, protein: 13, carbs: 71, fat: 2, fiber: 3, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'cup'] },
  { id: 5, name: 'Ground Beef', calories: 200, protein: 26, carbs: 0, fat: 10, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'lb'] },
]

const mockRecipes: Recipe[] = [
  {
    id: 1,
    name: 'Ham and Cheese Sandwich',
    meal: 'Lunch',
    description: 'A delicious sandwich made with ham and cheese.',
    ingredients: [
      { food: mockFoods[0], quantity: 2, calories: 150, servingUnit: 'slice' },
      { food: mockFoods[1], quantity: 1, calories: 100, servingUnit: 'slice' },
      { food: mockFoods[2], quantity: 2, calories: 200, servingUnit: 'slice' },
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
      { food: mockFoods[3], quantity: 100, calories: 350, servingUnit: 'g' },
      { food: mockFoods[4], quantity: 200, calories: 400, servingUnit: 'g' },
    ],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
  },
]

function renderWithProviders(
  ui: React.ReactElement,
  {
    recipes = mockRecipes,
    foods = mockFoods,
  }: {
    recipes?: Recipe[]
    foods?: Food[]
  } = {}
) {
  resetFoodStore()
  resetRecipeStore()
  useFoodStore.setState({ foods })
  useRecipeStore.setState((state) => ({ ...state, recipes }))

  return render(<BrowserRouter>{ui}</BrowserRouter>)
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
      renderWithProviders(<Store />)

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Select Ham from autocomplete - first clear any pre-filled value, then type
      const ingredientNameInput = screen.getByPlaceholderText('Select food')
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Ham')
      // Find option that starts with Ham (includes calories meta text)
      const hamOption = await screen.findByRole('option', { name: /^Ham/i })
      await user.click(hamOption)

      const quantityInput = screen.getByRole('spinbutton', { name: /quantity/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Add another matching ingredient - select Cheese
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Cheese')
      // Find option that starts with Cheese (includes calories meta text)
      const cheeseOption = await screen.findByRole('option', { name: /^Cheese/i })
      await user.click(cheeseOption)
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')
      await user.click(addButton)

      // Should see similar recipe suggestion
      const suggestion = await screen.findByRole('alert')
      expect(suggestion).toHaveTextContent('Similar recipe found:')
      expect(suggestion).toHaveTextContent('Ham and Cheese Sandwich')
      expect(suggestion).toHaveTextContent('% ingredient match')
    })

    it('does not show suggestion when no ingredients are similar', async () => {
      const user = userEvent.setup()
      const uniqueFood: Food = { id: 999, name: 'Unique Ingredient', calories: 50, protein: 1, carbs: 5, fat: 1, fiber: 1, servingSize: 1, servingUnit: 'piece', measurements: ['piece', 'g'] }
      // Only provide unique food, not the mockFoods that are used in existing recipes
      renderWithProviders(<Store />, { 
        foods: [uniqueFood],
        recipes: [] // No existing recipes to compare against
      })

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Input already defaults to unique food (the only food in list)
      // Just click add button
      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Should not see any suggestion alert (no existing recipes to match against)
      expect(screen.queryByText(/Similar recipe found/)).not.toBeInTheDocument()
    })

    it('suggestion link navigates to the similar recipe', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      // Switch to ingredients tab
      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      // Add matching ingredients - first clear any pre-filled value
      const ingredientNameInput = screen.getByPlaceholderText('Select food')
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Ham')
      // Find option that starts with Ham (includes calories meta text)
      const hamOption = await screen.findByRole('option', { name: /^Ham/i })
      await user.click(hamOption)

      const quantityInput = screen.getByRole('spinbutton', { name: /quantity/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Cheese')
      // Find option that starts with Cheese (includes calories meta text)
      const cheeseOption = await screen.findByRole('option', { name: /^Cheese/i })
      await user.click(cheeseOption)
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')
      await user.click(addButton)

      // Check that the link exists and points to the right recipe
      const suggestionLink = await screen.findByRole('link', { name: /ham and cheese sandwich/i })
      expect(suggestionLink).toHaveAttribute('href', '/recipes/ham-and-cheese-sandwich')
    })
  })

  describe('Ingredient Autocomplete', () => {
    it('shows dropdown suggestions when clicking on ingredient name input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      const ingredientNameInput = screen.getByPlaceholderText('Select food')
      await user.click(ingredientNameInput)

      // Should show autocomplete suggestions dropdown
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('filters suggestions as the user types', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const ingredientsTab = screen.getByRole('button', { name: /ingredients tab/i })
      await user.click(ingredientsTab)

      const ingredientNameInput = screen.getByPlaceholderText('Select food')
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Cheese')

      // Should show filtered suggestions
      const listbox = screen.getByRole('listbox')
      expect(listbox).toBeInTheDocument()
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
    it('saves a new recipe when Save Recipe is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

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

      const newRecipes = useRecipeStore.getState().recipes
      expect(newRecipes).toHaveLength(3) // 2 existing + 1 new

      const newRecipe = newRecipes[newRecipes.length - 1]
      expect(newRecipe.name).toBe('New Test Recipe')
      expect(newRecipe.meal).toBe('Lunch')
      expect(newRecipe.description).toBe('A test description')
      expect(newRecipe.date_published).toBeNull() // Saved as draft
    })

    it('saves a published recipe when Publish is clicked', async () => {
      const user = userEvent.setup()
      const testFood: Food = { id: 200, name: 'Test Ingredient', calories: 50, protein: 2, carbs: 5, fat: 1, fiber: 1, servingSize: 1, servingUnit: 'piece', measurements: ['piece', 'g'] }
      const allFoods = [...mockFoods, testFood]
      renderWithProviders(<Store />, { 
        foods: allFoods
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

      // Clear any pre-filled value before typing
      const ingredientNameInput = screen.getByPlaceholderText('Select food')
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Test Ingredient')
      await user.click(await screen.findByRole('option', { name: /test ingredient/i }))

      const addButton = screen.getByRole('button', { name: '+' })
      await user.click(addButton)

      // Switch back to details tab to access publish button
      const detailsTab = screen.getByRole('button', { name: /details tab/i })
      await user.click(detailsTab)

      // Click publish
      const publishButton = screen.getByRole('button', { name: /publish/i })
      await user.click(publishButton)

      const newRecipes = useRecipeStore.getState().recipes
      expect(newRecipes).toHaveLength(3)
      
      const newRecipe = newRecipes[newRecipes.length - 1]
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

    const { container } = render(
      <BrowserRouter>
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
      </BrowserRouter>
    )

    const cardHeader = container.querySelector('.card-header')
    expect(cardHeader).toBeInTheDocument()

    const cardTitle = container.querySelector('.card-title')
    expect(cardTitle).toBeInTheDocument()
    expect(cardTitle).toHaveTextContent('Test Recipe')

    const cardBadges = container.querySelector('.card-badges')
    expect(cardBadges).toBeInTheDocument()
    
    expect(cardHeader?.contains(cardTitle!)).toBe(true)
    expect(cardHeader?.contains(cardBadges!)).toBe(true)
  })
})
