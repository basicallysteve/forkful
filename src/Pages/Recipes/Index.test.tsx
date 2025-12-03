import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Recipes from './Index'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'

// Mock foods
const mockFoods: Food[] = [
  { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 2, name: 'Cheese', calories: 100, protein: 7, carbs: 0, fat: 8, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 3, name: 'Spaghetti', calories: 350, protein: 13, carbs: 71, fat: 2, fiber: 3, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'cup'] },
  { id: 4, name: 'Ground Beef', calories: 200, protein: 26, carbs: 0, fat: 10, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'lb'] },
  { id: 5, name: 'Romaine Lettuce', calories: 15, protein: 1, carbs: 3, fat: 0, fiber: 2, servingSize: 100, servingUnit: 'g', measurements: ['g', 'cup'] },
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
      { food: mockFoods[2], quantity: 100, calories: 350, servingUnit: 'g' },
      { food: mockFoods[3], quantity: 200, calories: 400, servingUnit: 'g' },
    ],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
  },
  {
    id: 3,
    name: 'Caesar Salad',
    meal: 'Lunch',
    description: 'A fresh salad with romaine lettuce, croutons, and Caesar dressing.',
    ingredients: [
      { food: mockFoods[4], quantity: 100, calories: 15, servingUnit: 'g' },
    ],
    date_added: new Date('2025-12-01'),
    date_published: new Date('2025-12-02'),
  },
]

function renderWithProviders(
  ui: React.ReactElement,
  { recipes = mockRecipes, setRecipes = vi.fn() }: { recipes?: Recipe[]; setRecipes?: (recipes: Recipe[]) => void } = {}
) {
  const contextValue: RecipeContextType = {
    recipes,
    setRecipes,
    existingIngredients: [],
  }

  return render(
    <BrowserRouter>
      <GlobalRecipeContext.Provider value={contextValue}>
        {ui}
      </GlobalRecipeContext.Provider>
    </BrowserRouter>
  )

  return { setRecipes }
}

describe('Recipes Page', () => {
  describe('Rendering', () => {
    it('renders the page title', () => {
      renderWithProviders(<Recipes />)
      expect(screen.getByText('All Recipes')).toBeInTheDocument()
    })

    it('displays the recipe count', () => {
      renderWithProviders(<Recipes />)
      expect(screen.getByText('3 recipes')).toBeInTheDocument()
    })

    it('renders all recipe cards', () => {
      renderWithProviders(<Recipes />)
      expect(screen.getByText('Ham and Cheese Sandwich')).toBeInTheDocument()
      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Caesar Salad')).toBeInTheDocument()
    })

    it('displays recipe descriptions', () => {
      renderWithProviders(<Recipes />)
      expect(screen.getByText('A delicious sandwich made with ham and cheese.')).toBeInTheDocument()
      expect(screen.getByText('A classic Italian pasta dish with a rich meat sauce.')).toBeInTheDocument()
    })

    it('displays meal category badges', () => {
      renderWithProviders(<Recipes />)
      // Get all recipe cards and check they have meal badges
      const cards = screen.getAllByRole('link')
      expect(cards.length).toBe(3)
      // Check that badges are rendered within the cards
      const dinnerCard = screen.getByText('Spaghetti Bolognese').closest('.recipe-card') as HTMLElement
      expect(dinnerCard).toBeInTheDocument()
      expect(within(dinnerCard).getByText('Dinner')).toBeInTheDocument()
    })

    it('displays ingredient count for each recipe', () => {
      renderWithProviders(<Recipes />)
      expect(screen.getAllByText('2 ingredients')).toHaveLength(2)
      expect(screen.getByText('1 ingredient')).toBeInTheDocument()
    })

    it('shows empty state when no recipes', () => {
      renderWithProviders(<Recipes />, { recipes: [] })
      expect(screen.getByText('No recipes found. Start by adding a new recipe!')).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it('filters recipes by meal category', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      await user.selectOptions(categorySelect, 'Lunch')

      expect(screen.getByText('Ham and Cheese Sandwich')).toBeInTheDocument()
      expect(screen.getByText('Caesar Salad')).toBeInTheDocument()
      expect(screen.queryByText('Spaghetti Bolognese')).not.toBeInTheDocument()
    })

    it('shows all recipes when "All Categories" is selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      await user.selectOptions(categorySelect, 'Lunch')
      await user.selectOptions(categorySelect, 'all')

      expect(screen.getByText('Ham and Cheese Sandwich')).toBeInTheDocument()
      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Caesar Salad')).toBeInTheDocument()
    })
  })

  describe('Sorting', () => {
    it('changes sort option', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i })
      await user.selectOptions(sortSelect, 'name')

      // Verify the sort option was changed
      expect(sortSelect).toHaveValue('name')
    })

    it('toggles sort direction', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const sortButton = screen.getByRole('button', { name: /sort/i })
      expect(sortButton).toHaveTextContent('↓')

      await user.click(sortButton)
      expect(sortButton).toHaveTextContent('↑')

      await user.click(sortButton)
      expect(sortButton).toHaveTextContent('↓')
    })
  })

  describe('Selection', () => {
    it('selects individual recipe when checkbox is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const checkbox = screen.getByRole('checkbox', { name: /select ham and cheese sandwich/i })
      await user.click(checkbox)

      expect(checkbox).toBeChecked()
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('selects all recipes when "Select all" is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
      await user.click(selectAllCheckbox)

      expect(selectAllCheckbox).toBeChecked()
      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('deselects all recipes when "Select all" is clicked again', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
      await user.click(selectAllCheckbox)
      await user.click(selectAllCheckbox)

      expect(selectAllCheckbox).not.toBeChecked()
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
    })

    it('shows action buttons when recipes are selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Recipes />)

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /unpublish/i })).not.toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox', { name: /select ham and cheese sandwich/i })
      await user.click(checkbox)

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument()
    })
  })

  describe('Delete functionality', () => {
    it('deletes selected recipes', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Recipes />, { setRecipes })

      const checkbox = screen.getByRole('checkbox', { name: /select ham and cheese sandwich/i })
      await user.click(checkbox)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(setRecipes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 2 }),
          expect.objectContaining({ id: 3 }),
        ])
      )
      expect(setRecipes).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({ id: 1 }),
        ])
      )
    })
  })

  describe('Unpublish functionality', () => {
    it('unpublishes selected recipes', async () => {
      const user = userEvent.setup()
      const setRecipes = vi.fn()
      renderWithProviders(<Recipes />, { setRecipes })

      const checkbox = screen.getByRole('checkbox', { name: /select ham and cheese sandwich/i })
      await user.click(checkbox)

      const unpublishButton = screen.getByRole('button', { name: /unpublish/i })
      await user.click(unpublishButton)

      expect(setRecipes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, date_published: null }),
          expect.objectContaining({ id: 2, date_published: new Date('2025-12-02') }),
          expect.objectContaining({ id: 3, date_published: new Date('2025-12-02') }),
        ])
      )
    })
  })

  describe('Navigation', () => {
    it('renders recipe cards as links to recipe details', () => {
      renderWithProviders(<Recipes />)

      const links = screen.getAllByRole('link')
      expect(links.some(link => link.getAttribute('href') === '/recipes/ham-and-cheese-sandwich')).toBe(true)
      expect(links.some(link => link.getAttribute('href') === '/recipes/spaghetti-bolognese')).toBe(true)
      expect(links.some(link => link.getAttribute('href') === '/recipes/caesar-salad')).toBe(true)
    })
  })
})

describe('Recipes filters and actions', () => {
  it('filters recipes by meal category', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Recipes />, { recipes: [
      {
        id: 1,
        name: 'Chili Bowl',
        meal: 'Lunch',
        description: 'A spicy bowl of chili.',
        ingredients: [],
      },
      {
        id: 2,
        name: 'Garlic Pasta',
        meal: 'Dinner',
        description: 'Pasta with garlic sauce.',
        ingredients: [],
      },
      {
        id: 3,
        name: 'Berry Oatmeal',
        meal: 'Breakfast',
        description: 'Oatmeal topped with fresh berries.',
        ingredients: [],
      },
    ]})
    

    const categorySelect = screen.getByLabelText(/category/i)
    await user.selectOptions(categorySelect, 'Lunch')

    expect(screen.getByText('Chili Bowl')).toBeInTheDocument()
    expect(screen.queryByText('Garlic Pasta')).not.toBeInTheDocument()
    expect(screen.queryByText('Berry Oatmeal')).not.toBeInTheDocument()
  })

  it('searches recipes by name and description', async () => {
    const user = userEvent.setup()
    const testFoods: Food[] = [
      { id: 101, name: 'Chili Powder', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'tsp', measurements: ['tsp', 'tbsp'] },
      { id: 102, name: 'Garlic', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'clove', measurements: ['clove', 'g'] },
    ]
    renderWithProviders(<Recipes />, { recipes: [
      {
        id: 1,
        name: 'Chili Bowl',
        meal: 'Lunch',
        description: 'A spicy bowl of chili.',
        ingredients: [
          { food: testFoods[0], quantity: 2, calories: 10, servingUnit: 'tsp' },
          { food: testFoods[1], quantity: 1, calories: 5, servingUnit: 'clove' }
        ],
      },
      {
        id: 2,
        name: 'Garlic Pasta',
        meal: 'Dinner',
        description: 'Pasta with garlic sauce.',
        ingredients: [],
      },
      {
        id: 3,
        name: 'Berry Oatmeal',
        meal: 'Breakfast',
        description: 'Oatmeal topped with fresh berries.',
        ingredients: [],
      },
    ]})
    const searchInput = screen.getByPlaceholderText(/search recipes/i)
    await user.type(searchInput, 'garlic')

    expect(screen.getByText('Garlic Pasta')).toBeInTheDocument()
    expect(screen.queryByText('Chili Bowl')).toBeInTheDocument()
    expect(screen.queryByText('Berry Oatmeal')).not.toBeInTheDocument()
  })

  it('sorts recipes by name and toggles direction', async () => {
    const user = userEvent.setup()

    renderWithProviders(<Recipes />, { recipes: [
      {
        id: 1,
        name: 'Chili Bowl',
        meal: 'Lunch',
        description: 'A spicy bowl of chili.',
        ingredients: [],
      },
      {
        id: 2,
        name: 'Garlic Pasta',
        meal: 'Dinner',
        description: 'Pasta with garlic sauce.',
        ingredients: [],
      },
      {
        id: 3,
        name: 'Berry Oatmeal',
        meal: 'Breakfast',
        description: 'Oatmeal topped with fresh berries.',
        ingredients: [],
      },
    ]})
    const sortSelect = screen.getByLabelText(/sort by/i)
    await user.selectOptions(sortSelect, 'name')

    const getTitles = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(getTitles()).toEqual(['Garlic Pasta', 'Chili Bowl', 'Berry Oatmeal'])

    const sortDirectionButton = screen.getByRole('button', { name: /sort ascending/i })
    await user.click(sortDirectionButton)

    expect(getTitles()).toEqual(['Berry Oatmeal', 'Chili Bowl', 'Garlic Pasta'])
  })

  it('deletes selected recipes', async () => {
    const user = userEvent.setup()
    const setRecipes = vi.fn()
    renderWithProviders(<Recipes />, { setRecipes, recipes: [
      {
        id: 1,
        name: 'Chili Bowl',
        meal: 'Lunch',
        description: 'A spicy bowl of chili.',
        ingredients: [],
      },
      {
        id: 2,
        name: 'Garlic Pasta',
        meal: 'Dinner',
        description: 'Pasta with garlic sauce.',
        ingredients: [],
      },
      {
        id: 3,
        name: 'Berry Oatmeal',
        meal: 'Breakfast',
        description: 'Oatmeal topped with fresh berries.',
        ingredients: [],
      },
    ]})

    await user.click(screen.getByLabelText('Select Garlic Pasta'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(setRecipes).toHaveBeenCalledTimes(1)
    const updated = setRecipes.mock.calls[0][0] as Recipe[]
    expect(updated).toHaveLength(2)
    expect(updated.find((recipe) => recipe.name === 'Garlic Pasta')).toBeUndefined()
  })
})
