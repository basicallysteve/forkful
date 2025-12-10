import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import PantryStore from './Store'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

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
]

function renderWithProviders(
  ui: React.ReactElement,
  {
    items = [],
    foods = mockFoods,
  }: {
    items?: PantryItem[]
    foods?: Food[]
  } = {}
) {
  resetPantryStore()
  resetFoodStore()
  useFoodStore.setState({ foods })
  usePantryStore.setState({ items })

  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

// Helper to create valid pantry items with all required fields
function createPantryItem(overrides: Partial<PantryItem> & { id: number; food: Food }): PantryItem {
  return {
    quantity: 1,
    quantityLeft: 1,
    originalSize: { size: 1, unit: 'oz' },
    currentSize: { size: 1, unit: 'oz' },
    expirationDate: new Date(),
    addedDate: new Date(),
    status: 'good',
    frozenDate: null,
    ...overrides,
  }
}

describe('Pantry Store Page', () => {
  beforeEach(() => {
    resetPantryStore()
    resetFoodStore()
  })

  describe('Add Mode', () => {
    it('renders page title for adding new item', () => {
      renderWithProviders(<PantryStore />)
      expect(screen.getByText('Add Pantry Item')).toBeInTheDocument()
    })

    it('renders all form fields', () => {
      renderWithProviders(<PantryStore />)
      expect(screen.getByLabelText(/food item/i)).toBeInTheDocument()
      expect(screen.getByRole("spinbutton", { name: /Quantity \*/ })).toBeInTheDocument()
      expect(screen.getByLabelText(/quantity left/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/original size/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/current size/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument()
    })

    it('add button is disabled when fields are incomplete', () => {
      renderWithProviders(<PantryStore />)
      const addButton = screen.getByRole('button', { name: /add item/i })
      expect(addButton).toBeDisabled()
    })

    it('adds a new item when all fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      // Select food
      const foodInput = screen.getByPlaceholderText('Select a food item')
      await user.type(foodInput, 'Chicken')
      const option = await screen.findByRole('option', { name: /chicken breast/i })
      await user.click(option)

      // Set quantity
      const quantityInput = screen.getByRole("spinbutton", { name: /Quantity \*/ })
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      // Set expiration date
      const dateInput = screen.getByLabelText(/expiration date/i)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const dateString = futureDate.toISOString().split('T')[0]
      await user.type(dateInput, dateString)

      const addButton = screen.getByRole('button', { name: /add item/i })
      expect(addButton).not.toBeDisabled()

      await user.click(addButton)

      const items = usePantryStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].food.name).toBe('Chicken Breast')
      expect(items[0].quantity).toBe(2)
    })
  })

  describe('Edit Mode', () => {
    it('renders page title for editing item', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        expirationDate: futureDate,
        quantity: 2,
        quantityLeft: 2,
        status: 'good',
      })

      renderWithProviders(<PantryStore existingItem={existingItem} />)
      expect(screen.getByText('Edit Pantry Item')).toBeInTheDocument()
    })

    it('pre-fills form with existing item data', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        expirationDate: futureDate,
        quantity: 3,
        quantityLeft: 3,
        status: 'good',
      })

      renderWithProviders(<PantryStore existingItem={existingItem} />)

      const foodInput = screen.getByPlaceholderText('Select a food item')
      expect(foodInput).toHaveValue('Chicken Breast')

      const quantityInput = screen.getByRole("spinbutton", { name: /Quantity \*/ }) as HTMLInputElement
      expect(quantityInput.value).toBe('3')
    })

    it('updates item when save is clicked', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        expirationDate: futureDate,
        quantity: 2,
        quantityLeft: 2,
        status: 'good',
      })

      renderWithProviders(<PantryStore existingItem={existingItem} />, {
        items: [existingItem],
      })

      const quantityInput = screen.getByRole("spinbutton", { name: /Quantity \*/ })
      await user.clear(quantityInput)
      await user.type(quantityInput, '5')

      const updateButton = screen.getByRole('button', { name: /update item/i })
      await user.click(updateButton)

      const items = usePantryStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(5)
    })
  })

  describe('Status Preview', () => {
    it('shows status preview when expiration date is selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      const dateInput = screen.getByLabelText(/expiration date/i)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      const dateString = futureDate.toISOString().split('T')[0]
      await user.type(dateInput, dateString)

      expect(screen.getByText(/status:/i)).toBeInTheDocument()
      expect(screen.getByText(/good/i)).toBeInTheDocument()
    })

    it('shows expiring-soon status for near expiration dates', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      const dateInput = screen.getByLabelText(/expiration date/i)
      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 5)
      const dateString = soonDate.toISOString().split('T')[0]
      await user.type(dateInput, dateString)

      expect(screen.getByText(/expiring-soon/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('requires food item to be selected', () => {
      renderWithProviders(<PantryStore />)
      const addButton = screen.getByRole('button', { name: /add item/i })
      expect(addButton).toBeDisabled()
    })

    it('requires quantity to be positive', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      const quantityInput = screen.getByRole('spinbutton', { name: /Quantity \*/i })
      await user.clear(quantityInput)
      await user.type(quantityInput, '0')

      const addButton = screen.getByRole('button', { name: /add item/i })
      expect(addButton).toBeDisabled()
    })
  })

  describe('Cancel Button', () => {
    it('renders cancel button', () => {
      renderWithProviders(<PantryStore />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })
})
