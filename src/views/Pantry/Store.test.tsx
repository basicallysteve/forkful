import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryStore from './Store'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/pantry', () => ({
  apiCreatePantryItem: vi.fn(),
  apiUpdatePantryItem: vi.fn(),
}))

import { apiCreatePantryItem, apiUpdatePantryItem } from '@/lib/api/pantry'

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
  { items = [], foods = mockFoods }: { items?: PantryItem[]; foods?: Food[] } = {}
) {
  resetPantryStore()
  resetFoodStore()
  useFoodStore.setState({ foods })
  usePantryStore.setState({ items })
  return render(ui)
}

function createPantryItem(overrides: Partial<PantryItem> & { id: number; food: Food }): PantryItem {
  return {
    id: overrides.id,
    food: overrides.food,
    originalSize: { size: 1, unit: 'oz' },
    currentSize: { size: 1, unit: 'oz' },
    expirationDate: new Date(),
    addedDate: new Date(),
    status: 'good',
    frozenDate: null,
    ...overrides,
  }
}

function makeMockItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return createPantryItem({ id: 1, food: mockFoods[0], ...overrides })
}

describe('Pantry Store Page', () => {
  beforeEach(() => {
    resetPantryStore()
    resetFoodStore()
    vi.clearAllMocks()
  })

  describe('Add Mode', () => {
    it('renders page title for adding new item', () => {
      renderWithProviders(<PantryStore />)
      expect(screen.getByText('Add Pantry Item')).toBeInTheDocument()
    })

    it('renders all form fields', () => {
      const { container } = renderWithProviders(<PantryStore />)
      expect(screen.getByLabelText(/food item/i)).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /original size/i })).toBeInTheDocument()
      expect(container.querySelector('#original-unit')).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /current size/i })).toBeInTheDocument()
      expect(container.querySelector('#current-unit')).toBeInTheDocument()
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument()
    })

    it('add button is disabled when no food is selected', () => {
      renderWithProviders(<PantryStore />)
      expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    })

    it('calls apiCreatePantryItem and adds item to store on save', async () => {
      const user = userEvent.setup()
      const createdItem = makeMockItem({ originalSize: { size: 16, unit: 'oz' }, currentSize: { size: 8, unit: 'oz' } })
      vi.mocked(apiCreatePantryItem).mockResolvedValue(createdItem)

      renderWithProviders(<PantryStore />)

      await user.type(screen.getByPlaceholderText('Select a food item'), 'Chicken')
      await user.click(await screen.findByRole('option', { name: /chicken breast/i }))

      const originalSizeInput = screen.getByRole('spinbutton', { name: /original size/i })
      await user.clear(originalSizeInput)
      await user.type(originalSizeInput, '16')

      const currentSizeInput = screen.getByRole('spinbutton', { name: /current size/i })
      await user.clear(currentSizeInput)
      await user.type(currentSizeInput, '8')

      await user.click(screen.getByRole('button', { name: /add item/i }))

      expect(apiCreatePantryItem).toHaveBeenCalledWith(expect.objectContaining({
        foodId: 1,
        originalSizeAmount: 16,
        currentSizeAmount: 8,
      }))
      await waitFor(() => expect(usePantryStore.getState().items).toHaveLength(1))
      expect(usePantryStore.getState().items[0].food.name).toBe('Chicken Breast')
    })
  })

  describe('Edit Mode', () => {
    it('renders page title for editing item', () => {
      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        originalSize: { size: 3, unit: 'oz' },
        currentSize: { size: 2, unit: 'oz' },
        status: 'good',
      })
      renderWithProviders(<PantryStore existingItem={existingItem} />)
      expect(screen.getByText('Edit Pantry Item')).toBeInTheDocument()
    })

    it('pre-fills form with existing item data', () => {
      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        originalSize: { size: 3, unit: 'oz' },
        currentSize: { size: 2, unit: 'oz' },
        status: 'good',
      })
      renderWithProviders(<PantryStore existingItem={existingItem} />)

      expect(screen.getByPlaceholderText('Select a food item')).toHaveValue('Chicken Breast')
      expect((screen.getByRole('spinbutton', { name: /original size/i }) as HTMLInputElement).value).toBe('3')
      expect((screen.getByRole('spinbutton', { name: /current size/i }) as HTMLInputElement).value).toBe('2')
    })

    it('calls apiUpdatePantryItem and updates the store on save', async () => {
      const user = userEvent.setup()
      const existingItem = createPantryItem({
        id: 1,
        food: mockFoods[0],
        originalSize: { size: 3, unit: 'oz' },
        currentSize: { size: 2, unit: 'oz' },
        status: 'good',
      })
      const updatedItem = { ...existingItem, currentSize: { size: 1.5, unit: 'oz' } }
      vi.mocked(apiUpdatePantryItem).mockResolvedValue(updatedItem)

      renderWithProviders(<PantryStore existingItem={existingItem} />, { items: [existingItem] })

      const currentSizeInput = screen.getByRole('spinbutton', { name: /current size/i })
      await user.clear(currentSizeInput)
      await user.type(currentSizeInput, '1.5')

      await user.click(screen.getByRole('button', { name: /update item/i }))

      expect(apiUpdatePantryItem).toHaveBeenCalledWith(1, expect.objectContaining({ currentSizeAmount: 1.5 }))
      await waitFor(() => expect(usePantryStore.getState().items[0].currentSize.size).toBe(1.5))
    })
  })

  describe('Status Preview', () => {
    it('shows status preview when expiration date is selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      const dateString = futureDate.toISOString().split('T')[0]

      await user.type(screen.getByLabelText(/expiration date/i), dateString)

      expect(screen.getByText(/status:/i)).toBeInTheDocument()
      expect(screen.getByText(/good/i)).toBeInTheDocument()
    })

    it('shows expiring-soon status for near expiration dates', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PantryStore />)

      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 3)
      const dateString = soonDate.toISOString().split('T')[0]

      await user.type(screen.getByLabelText(/expiration date/i), dateString)

      expect(screen.getByText(/expiring-soon/i)).toBeInTheDocument()
    })
  })
})
