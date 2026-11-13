import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Store from './Store'
import { apiCreateRecipe } from '@/lib/api/recipes'
import { useRecipeStore, resetRecipeStore } from '@/stores/recipes'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/recipes', () => ({
  apiCreateRecipe: vi.fn(async (r) => ({ ...r, id: 3 })),
}))

// Mock foods
const mockFoods: Food[] = [
  { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'oz' }, { unit: 'g' }] },
  { id: 2, name: 'Cheese', calories: 100, protein: 7, carbs: 0, fat: 8, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'oz' }, { unit: 'g' }] },
  { id: 3, name: 'Bread', calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 2, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'loaf' }] },
  { id: 4, name: 'Spaghetti', calories: 350, protein: 13, carbs: 71, fat: 2, fiber: 3, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'oz' }, { unit: 'cup' }] },
  { id: 5, name: 'Ground Beef', calories: 200, protein: 26, carbs: 0, fat: 10, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'oz' }, { unit: 'lb' }] },
]

const mockRecipes: Recipe[] = [
  {
    id: 1,
    shortId: 'aaa11111',
    name: 'Ham and Cheese Sandwich',
    meal: 'Lunch',
    description: 'A delicious sandwich made with ham and cheese.',
    ingredients: [
      { food: mockFoods[0], quantity: 2, calories: 150, servingUnit: 'slice' },
      { food: mockFoods[1], quantity: 1, calories: 100, servingUnit: 'slice' },
      { food: mockFoods[2], quantity: 2, calories: 200, servingUnit: 'slice' },
    ],
    steps: [],
    date_added: new Date('2025-11-21'),
    date_published: new Date('2025-11-22'),
    isPublic: false,
    nutritionComplete: true,
  },
  {
    id: 2,
    shortId: 'bbb22222',
    name: 'Spaghetti Bolognese',
    meal: 'Dinner',
    description: 'A classic Italian pasta dish with a rich meat sauce.',
    ingredients: [
      { food: mockFoods[3], quantity: 100, calories: 350, servingUnit: 'g' },
      { food: mockFoods[4], quantity: 200, calories: 400, servingUnit: 'g' },
    ],
    steps: [],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
    isPublic: false,
    nutritionComplete: true,
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

  return render(ui)
}

describe('Store Page - Recipe Creation', () => {
  describe('Save Recipe button enablement', () => {
    it('enables Save Recipe button when all required fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Smoky chipotle chili')
      await user.type(nameInput, 'Ham and Cheese Sandwich')

      const lunchRadio = screen.getByRole('radio', { name: /lunch/i })
      await user.click(lunchRadio)

      const descriptionInput = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionInput, 'A test description')

      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      expect(saveButton).not.toBeDisabled()
    })

    it('disables Save Recipe button when required fields are missing', async () => {
      renderWithProviders(<Store />)
      const saveButton = screen.getByRole('button', { name: /save recipe/i })
      expect(saveButton).toBeDisabled()
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

      const quantityInput = screen.getByLabelText(/amount/i)
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addButton)

      // Add another matching ingredient - select Cheese
      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Cheese')
      // Find option that starts with Cheese (includes calories meta text)
      const cheeseOption = await screen.findByRole('option', { name: /^Cheese/i })
      await user.click(cheeseOption)
      const cheeseQuantity = screen.getByLabelText(/amount/i)
      await user.clear(cheeseQuantity)
      await user.type(cheeseQuantity, '1')
      await user.click(addButton)

      // Should see similar recipe suggestion
      const suggestion = await screen.findByRole('alert')
      expect(suggestion).toHaveTextContent('Similar recipe found:')
      expect(suggestion).toHaveTextContent('Ham and Cheese Sandwich')
      expect(suggestion).toHaveTextContent('% ingredient match')
    })

    it('does not show suggestion when no ingredients are similar', async () => {
      const user = userEvent.setup()
      const uniqueFood: Food = { id: 999, name: 'Unique Ingredient', calories: 50, protein: 1, carbs: 5, fat: 1, fiber: 1, servingSize: 1, servingUnit: 'piece', measurements: [{ unit: 'piece' }, { unit: 'g' }] }
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
      const addButton = screen.getByRole('button', { name: /add ingredient/i })
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

      const quantityInput = screen.getByLabelText(/amount/i)
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      const addButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addButton)

      await user.clear(ingredientNameInput)
      await user.type(ingredientNameInput, 'Cheese')
      // Find option that starts with Cheese (includes calories meta text)
      const cheeseOption = await screen.findByRole('option', { name: /^Cheese/i })
      await user.click(cheeseOption)
      const cheeseQuantity = screen.getByLabelText(/amount/i)
      await user.clear(cheeseQuantity)
      await user.type(cheeseQuantity, '1')
      await user.click(addButton)

      // Check that the link exists and points to the right recipe
      const suggestionLink = await screen.findByRole('link', { name: /ham and cheese sandwich/i })
      expect(suggestionLink).toHaveAttribute('href', '/recipes/aaa11111/ham-and-cheese-sandwich')
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

      await waitFor(() => {
        const newRecipes = useRecipeStore.getState().recipes
        expect(newRecipes).toHaveLength(3) // 2 existing + 1 new
  
        const newRecipe = newRecipes[newRecipes.length - 1]
        expect(newRecipe.name).toBe('New Test Recipe')
        expect(newRecipe.meal).toBe('Lunch')
        expect(newRecipe.description).toBe('A test description')
        expect(newRecipe.date_published).toBeNull() // Saved as draft
      })
    })

    it('saves a published recipe when Publish is clicked', async () => {
      const user = userEvent.setup()
      const testFood: Food = { id: 200, name: 'Test Ingredient', calories: 50, protein: 2, carbs: 5, fat: 1, fiber: 1, servingSize: 1, servingUnit: 'piece', measurements: [{ unit: 'piece' }, { unit: 'g' }] }
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

      const addButton = screen.getByRole('button', { name: /add ingredient/i })
      await user.click(addButton)

      // Switch back to details tab to access publish button
      const detailsTab = screen.getByRole('button', { name: /details tab/i })
      await user.click(detailsTab)

      // Click publish
      const publishButton = screen.getByRole('button', { name: /publish/i })
      await user.click(publishButton)

      await waitFor(() => {
        const newRecipes = useRecipeStore.getState().recipes
        expect(newRecipes).toHaveLength(3)
        
        const newRecipe = newRecipes[newRecipes.length - 1]
        expect(newRecipe.name).toBe('Published Recipe')
        expect(newRecipe.date_published).not.toBeNull() // Published with date
      })
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
  describe('Description Editor', () => {
    it('renders the description editor with placeholder', () => {
      renderWithProviders(<Store />)

      const descriptionEditor = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      expect(descriptionEditor).toBeInTheDocument()
    })

    it('accepts text input in the description editor', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const descriptionEditor = screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.')
      await user.type(descriptionEditor, 'A tasty recipe description')

      expect(descriptionEditor).toHaveValue('A tasty recipe description')
    })
  })
})

describe('Recipes List - Card Layout', () => {
  it('renders card header with title and badges on the same row', () => {

    const { container } = render(
      <div className="recipes-list">
        <div className="recipe-card">
          <div className="card-content">
            <div className="card-header">
              <h3 className="card-title">Test Recipe</h3>
              <div className="card-badges">
                <span className="p-tag">Lunch</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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

describe('Store Page - editing an added ingredient (#16)', () => {
  async function addHam(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
    const nameInput = screen.getByPlaceholderText('Select food')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ham')
    await user.click(await screen.findByRole('option', { name: /^Ham/i }))
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))
  }

  it('lets the user change the quantity of an added ingredient', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await addHam(user)

    // [0] is the blank "new ingredient" row, [1] is the added Ham row
    const addedQuantity = screen.getAllByLabelText(/amount/i)[1]
    expect(addedQuantity).not.toHaveAttribute('readonly')
    await user.clear(addedQuantity)
    await user.type(addedQuantity, '4')
    // 75 cal per slice * 4
    await user.tab()
    expect(screen.getAllByRole('spinbutton', { name: /calories/i })[1]).toHaveValue('300')
  })

  it('saves the edited quantity and calories, not the values at the time of adding', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await addHam(user)

    const addedQuantity = screen.getAllByLabelText(/amount/i)[1]
    await user.clear(addedQuantity)
    await user.type(addedQuantity, '4')
    await user.tab()

    await user.click(screen.getByRole('button', { name: /details tab/i }))
    await user.type(screen.getByPlaceholderText('e.g. Smoky chipotle chili'), 'Test Ham Plate')
    await user.click(screen.getByRole('radio', { name: /lunch/i }))
    await user.type(screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.'), 'desc')
    await user.click(screen.getByRole('button', { name: /save recipe/i }))

    await waitFor(() => expect(apiCreateRecipe).toHaveBeenCalled())
    const saved = vi.mocked(apiCreateRecipe).mock.calls.at(-1)![0]
    expect(saved.ingredients).toHaveLength(1)
    expect(saved.ingredients[0]).toMatchObject({ quantity: 4, calories: 300, servingUnit: 'slice' })
  })

  it('keeps the right values when the same food is added twice and the first row is removed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await addHam(user) // quantity 1

    // Second Ham with quantity 2
    const nameInput = screen.getAllByPlaceholderText('Select food')[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'Ham')
    await user.click(await screen.findByRole('option', { name: /^Ham/i }))
    const newRowQuantity = screen.getAllByLabelText(/amount/i)[0]
    await user.clear(newRowQuantity)
    await user.type(newRowQuantity, '2')
    await user.tab()
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))

    // Remove the first stored Ham row
    await user.click(screen.getAllByRole('button', { name: /remove/i })[0])

    const quantities = screen.getAllByLabelText(/amount/i)
    expect(quantities).toHaveLength(2) // new row + survivor
    expect(quantities[1]).toHaveValue('2')
    expect(screen.getAllByRole('spinbutton', { name: /calories/i })[1]).toHaveValue('150')

    // Editing the survivor changes only it, and the saved payload matches
    await user.clear(quantities[1])
    await user.type(quantities[1], '3')
    await user.tab()
    await user.click(screen.getByRole('button', { name: /details tab/i }))
    await user.type(screen.getByPlaceholderText('e.g. Smoky chipotle chili'), 'Test Dup Ham')
    await user.click(screen.getByRole('radio', { name: /lunch/i }))
    await user.type(screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.'), 'desc')
    await user.click(screen.getByRole('button', { name: /save recipe/i }))
    await waitFor(() => expect(apiCreateRecipe).toHaveBeenCalled())
    const saved = vi.mocked(apiCreateRecipe).mock.calls.at(-1)![0]
    expect(saved.ingredients).toHaveLength(1)
    expect(saved.ingredients[0]).toMatchObject({ quantity: 3, calories: 225 })
  })

  it('parses a mixed fraction in the quantity box and saves it as a decimal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
    await user.type(screen.getAllByPlaceholderText('Select food')[0], 'Ham')
    await user.click(await screen.findByRole('option', { name: /^Ham/i }))

    const quantity = screen.getAllByLabelText(/amount/i)[0]
    await user.clear(quantity)
    await user.type(quantity, '1 1/2')
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))

    // 75 cal per slice * 1.5, shown back as a fraction in the stored row
    expect(screen.getAllByLabelText(/calories/i)[1]).toHaveValue('112.5')
    expect(screen.getAllByLabelText(/amount/i)[1]).toHaveValue('1½')

    await user.click(screen.getByRole('button', { name: /details tab/i }))
    await user.type(screen.getByPlaceholderText('e.g. Smoky chipotle chili'), 'Test Fraction Ham')
    await user.click(screen.getByRole('radio', { name: /lunch/i }))
    await user.type(screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.'), 'desc')
    await user.click(screen.getByRole('button', { name: /save recipe/i }))
    await waitFor(() => expect(apiCreateRecipe).toHaveBeenCalled())
    const saved = vi.mocked(apiCreateRecipe).mock.calls.at(-1)![0]
    expect(saved.ingredients[0].quantity).toBe(1.5)
  })

  it('edits a stored ingredient quantity with a fraction', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await addHam(user)
    const stored = screen.getAllByLabelText(/amount/i)[1]
    await user.clear(stored)
    await user.type(stored, '3/4')
    await user.tab()
    expect(screen.getAllByLabelText(/calories/i)[1]).toHaveValue('56.25')
  })

  it('resets the add row to blank after a successful add', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))

    // Starts blank and cannot be added
    expect(screen.getAllByPlaceholderText('Select food')[0]).toHaveValue('')
    expect(screen.getByRole('button', { name: /add ingredient/i })).toBeDisabled()

    await user.type(screen.getAllByPlaceholderText('Select food')[0], 'Ham')
    await user.click(await screen.findByRole('option', { name: /^Ham/i }))
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))

    expect(screen.getAllByPlaceholderText('Select food')[0]).toHaveValue('')
    expect(screen.getAllByLabelText(/amount/i)[0]).toHaveValue('')
    expect(screen.getAllByLabelText(/amount/i)[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: /add ingredient/i })).toBeDisabled()
  })

  it('labels the row buttons and pluralises the ingredient count', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    expect(screen.getByText('0 ingredients')).toBeInTheDocument()
    await addHam(user)
    expect(screen.getByText('1 ingredient')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Ham' })).toBeInTheDocument()
    await user.type(screen.getAllByPlaceholderText('Select food')[0], 'Cheese')
    await user.click(await screen.findByRole('option', { name: /^Cheese/i }))
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))
    expect(screen.getByText('2 ingredients')).toBeInTheDocument()
  })

  it('keeps Add disabled until a food is picked and the quantity is above zero', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Store />)
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
    const addButton = () => screen.getByRole('button', { name: /add ingredient/i })
    expect(addButton()).toBeDisabled()

    await user.type(screen.getAllByPlaceholderText('Select food')[0], 'Ham')
    await user.click(await screen.findByRole('option', { name: /^Ham/i }))
    expect(addButton()).toBeEnabled()

    const quantity = screen.getAllByLabelText(/amount/i)[0]
    await user.clear(quantity)
    await user.tab()
    expect(addButton()).toBeDisabled()

    await user.type(quantity, '2')
    await user.tab()
    expect(addButton()).toBeEnabled()
  })

  it('lets the user change the unit of an added ingredient', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Store />)
    await addHam(user)

    const unitDropdown = () => container.querySelectorAll<HTMLElement>('.ingredient-unit-select')[1]
    expect(unitDropdown()).not.toHaveClass('p-disabled')
    // Open with the keyboard, then pick the next unit (slice -> oz)
    const trigger = unitDropdown().querySelector<HTMLElement>('[aria-haspopup="listbox"]')!
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await user.click(await screen.findByRole('option', { name: 'oz', hidden: true }))

    expect(unitDropdown()).toHaveTextContent('oz')
  })
})
