import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import PantryList from './Index'
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

describe('Pantry List Page', () => {
  beforeEach(() => {
    resetPantryStore()
    resetFoodStore()
  })

  describe('Empty State', () => {
    it('renders empty state when no items exist', () => {
      renderWithProviders(<PantryList />)
      expect(screen.getByText('No pantry items found.')).toBeInTheDocument()
      expect(screen.getByText('Add your first item')).toBeInTheDocument()
    })

    it('renders add item button in empty state', () => {
      renderWithProviders(<PantryList />)
      const addButtons = screen.getAllByRole('link', { name: /add/i })
      expect(addButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Stats Display', () => {
    it('displays correct counts for each status', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)

      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 5)

      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({
          id: 1,
          food: mockFoods[0],
          expirationDate: expiredDate,
          status: 'expired',
        }),
        createPantryItem({
          id: 2,
          food: mockFoods[1],
          expirationDate: soonDate,
          status: 'expiring-soon',
        }),
        createPantryItem({
          id: 3,
          food: mockFoods[0],
          expirationDate: goodDate,
          status: 'good',
        }),
      ]

      renderWithProviders(<PantryList />, { items })

      // Check stats using more specific queries
      const stats = document.querySelectorAll('.stat-card')
      expect(stats).toHaveLength(4)
      
      // Total items
      const totalCard = stats[0]
      expect(totalCard).toHaveTextContent('Total Items')
      expect(totalCard).toHaveTextContent('3')
      
      // Good items
      const goodCard = stats[1]
      expect(goodCard).toHaveTextContent('Good')
      expect(goodCard).toHaveTextContent('1')
      
      // Expiring soon items
      const warnCard = stats[2]
      expect(warnCard).toHaveTextContent('Expiring Soon')
      expect(warnCard).toHaveTextContent('1')
      
      // Expired items
      const dangerCard = stats[3]
      expect(dangerCard).toHaveTextContent('Expired')
      expect(dangerCard).toHaveTextContent('1')
    })
  })

  describe('Item List', () => {
    it('renders pantry items in table', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({
          id: 1,
          food: mockFoods[0],
          expirationDate: futureDate,
          originalSize: { size: 2, unit: 'lb' },
          currentSize: { size: 1.5, unit: 'lb' },
          status: 'good'
        }),
      ]

      renderWithProviders(<PantryList />, { items })

      expect(screen.getAllByText('Chicken Breast')[0]).toBeInTheDocument()
      const sizeDisplays = screen.getAllByText(/2\.00 lb \/ 1\.50 lb/)
      expect(sizeDisplays.length).toBeGreaterThan(0)
      const statusBadge = document.querySelector('.status-badge.status-good')
      expect(statusBadge).toHaveTextContent('Good')
    })

    it('renders edit and delete buttons for each item', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      expect(screen.getAllByRole('link', { name: /edit/i })[0]).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /delete/i })[0]).toBeInTheDocument()
    })
  })

  describe('Search and Filter', () => {
    it('filters items by search term', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good'}),
        createPantryItem({id: 2, food: mockFoods[1], expirationDate: futureDate, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      const searchInput = screen.getByPlaceholderText('Search pantry items...')
      await user.type(searchInput, 'Chicken')

      expect(screen.getAllByText('Chicken Breast')[0]).toBeInTheDocument()
      expect(screen.queryByText('Brown Rice')).not.toBeInTheDocument()
    })

    it('filters items by status', async () => {
      const user = userEvent.setup()
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)

      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[0], expirationDate: expiredDate, status: 'expired'}),
        createPantryItem({id: 2, food: mockFoods[1], expirationDate: goodDate, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      const statusFilter = screen.getByLabelText('Filter by status')
      await user.selectOptions(statusFilter, 'good')

      expect(screen.getAllByText('Brown Rice')[0]).toBeInTheDocument()
      // Expired item should not be visible
      const chickens = screen.queryAllByText('Chicken Breast')
      expect(chickens.length).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('can sort by expiration date', async () => {
      const user = userEvent.setup()
      const date1 = new Date()
      date1.setDate(date1.getDate() + 10)

      const date2 = new Date()
      date2.setDate(date2.getDate() + 20)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[1], expirationDate: date2, status: 'good'}),
        createPantryItem({id: 2, food: mockFoods[0], expirationDate: date1, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      const sortSelect = screen.getByLabelText('Sort by')
      await user.selectOptions(sortSelect, 'expirationDate')

      // Items should be sorted by expiration date ascending
      const rows = screen.getAllByRole('row')
      // Skip header row, check first data row
      expect(rows[1]).toHaveTextContent('Chicken Breast')
    })
  })

  describe('Bulk Actions', () => {
    it('can select all items', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good'}),
        createPantryItem({id: 2, food: mockFoods[1], expirationDate: futureDate, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      const selectAllCheckbox = screen.getByLabelText('Select all items')
      await user.click(selectAllCheckbox)

      expect(screen.getByText('2 item(s) selected')).toBeInTheDocument()
    })

    it('can delete selected items', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        createPantryItem({id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good'}),
      ]

      renderWithProviders(<PantryList />, { items })

      const checkbox = screen.getAllByLabelText('Select Chicken Breast')[0]
      await user.click(checkbox)

      const deleteButton = screen.getByRole('button', { name: /delete \(1\)/i })
      await user.click(deleteButton)

      const storeItems = usePantryStore.getState().items
      expect(storeItems).toHaveLength(0)
    })
  })
})
