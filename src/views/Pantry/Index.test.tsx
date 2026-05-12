import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryList from './Index'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/pantry', () => ({
  apiFetchPantryItems: vi.fn(),
  apiDeletePantryItem: vi.fn().mockResolvedValue(undefined),
  apiDeletePantryItems: vi.fn().mockResolvedValue(1),
  apiUpdatePantryItem: vi.fn(),
}))

import { apiFetchPantryItems, apiDeletePantryItem, apiDeletePantryItems, apiUpdatePantryItem } from '@/lib/api/pantry'

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

function renderWithItems(items: PantryItem[] = [], foods: Food[] = mockFoods) {
  resetPantryStore()
  resetFoodStore()
  useFoodStore.setState({ foods })
  vi.mocked(apiFetchPantryItems).mockResolvedValue(items)
  return render(<PantryList />)
}

describe('Pantry List Page', () => {
  beforeEach(() => {
    resetPantryStore()
    resetFoodStore()
    vi.clearAllMocks()
  })

  describe('Loading and Empty State', () => {
    it('shows loading state initially', () => {
      vi.mocked(apiFetchPantryItems).mockReturnValue(new Promise(() => {}))
      render(<PantryList />)
      expect(screen.getByText('Loading pantry...')).toBeInTheDocument()
    })

    it('renders empty state when no items exist', async () => {
      renderWithItems([])
      expect(await screen.findByText('No pantry items found.')).toBeInTheDocument()
      expect(screen.getByText('Add your first item')).toBeInTheDocument()
    })

    it('renders add item button in empty state', async () => {
      renderWithItems([])
      await screen.findByText('No pantry items found.')
      const addButtons = screen.getAllByRole('link', { name: /add/i })
      expect(addButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Stats Display', () => {
    it('displays correct counts for each status', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)

      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 5)

      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      renderWithItems([
        createPantryItem({ id: 1, food: mockFoods[0], expirationDate: expiredDate, status: 'expired' }),
        createPantryItem({ id: 2, food: mockFoods[1], expirationDate: soonDate, status: 'expiring-soon' }),
        createPantryItem({ id: 3, food: mockFoods[0], expirationDate: goodDate, status: 'good' }),
      ])

      await screen.findAllByText('Chicken Breast')

      const stats = document.querySelectorAll('.stat-card')
      expect(stats).toHaveLength(4)
      expect(stats[0]).toHaveTextContent('Total Items')
      expect(stats[0]).toHaveTextContent('3')
      expect(stats[1]).toHaveTextContent('Good')
      expect(stats[1]).toHaveTextContent('1')
      expect(stats[2]).toHaveTextContent('Expiring Soon')
      expect(stats[2]).toHaveTextContent('1')
      expect(stats[3]).toHaveTextContent('Expired')
      expect(stats[3]).toHaveTextContent('1')
    })
  })

  describe('Item List', () => {
    it('renders pantry items in table', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([
        createPantryItem({
          id: 1,
          food: mockFoods[0],
          expirationDate: futureDate,
          originalSize: { size: 2, unit: 'lb' },
          currentSize: { size: 1.5, unit: 'lb' },
          status: 'good',
        }),
      ])

      expect(await screen.findAllByText('Chicken Breast')).not.toHaveLength(0)
      expect(screen.getAllByText(/2\.00 lb \/ 1\.50 lb/).length).toBeGreaterThan(0)
      expect(document.querySelector('.status-badge.status-good')).toHaveTextContent('Good')
    })

    it('renders edit and delete buttons for each item', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' })])

      await screen.findAllByText('Chicken Breast')
      expect(screen.getAllByRole('link', { name: /edit/i })[0]).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /delete/i })[0]).toBeInTheDocument()
    })
  })

  describe('Delete', () => {
    it('calls the API and removes the item from the store', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' })])

      await screen.findAllByText('Chicken Breast')
      const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
      await user.click(deleteButtons[0])

      expect(apiDeletePantryItem).toHaveBeenCalledWith(1)
      await waitFor(() => expect(usePantryStore.getState().items).toHaveLength(0))
    })
  })

  describe('Freeze / Unfreeze', () => {
    it('calls the API and updates the store on freeze', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const item = createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' })
      vi.mocked(apiUpdatePantryItem).mockResolvedValue({ ...item, frozenDate: new Date() })

      renderWithItems([item])
      await screen.findAllByText('Chicken Breast')

      await user.click(screen.getAllByRole('button', { name: /freeze/i })[0])

      expect(apiUpdatePantryItem).toHaveBeenCalledWith(1, expect.objectContaining({ frozenDate: expect.any(String) }))
      await waitFor(() => expect(usePantryStore.getState().items[0].frozenDate).not.toBeNull())
    })

    it('calls the API and clears frozenDate on thaw', async () => {
      const user = userEvent.setup()
      const item = createPantryItem({ id: 1, food: mockFoods[0], status: 'good', frozenDate: new Date() })
      vi.mocked(apiUpdatePantryItem).mockResolvedValue({ ...item, frozenDate: null })

      renderWithItems([item])
      await screen.findAllByText('Chicken Breast')

      await user.click(screen.getAllByRole('button', { name: /thaw/i })[0])

      expect(apiUpdatePantryItem).toHaveBeenCalledWith(1, { frozenDate: null })
      await waitFor(() => expect(usePantryStore.getState().items[0].frozenDate).toBeNull())
    })
  })

  describe('Search and Filter', () => {
    it('filters items by search term', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([
        createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' }),
        createPantryItem({ id: 2, food: mockFoods[1], expirationDate: futureDate, status: 'good' }),
      ])

      await screen.findAllByText('Chicken Breast')

      await user.type(screen.getByPlaceholderText('Search pantry items...'), 'Chicken')

      expect(screen.getAllByText('Chicken Breast')[0]).toBeInTheDocument()
      expect(screen.queryByText('Brown Rice')).not.toBeInTheDocument()
    })

    it('filters items by status', async () => {
      const user = userEvent.setup()
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)

      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      renderWithItems([
        createPantryItem({ id: 1, food: mockFoods[0], expirationDate: expiredDate, status: 'expired' }),
        createPantryItem({ id: 2, food: mockFoods[1], expirationDate: goodDate, status: 'good' }),
      ])

      await screen.findAllByText('Brown Rice')

      const statusTrigger = screen.getByRole('button', { name: /filter by status/i })
      await user.click(statusTrigger)
      fireEvent.click(await screen.findByRole('option', { name: 'Good', hidden: true }))

      expect(screen.getAllByText('Brown Rice')[0]).toBeInTheDocument()
      expect(screen.queryAllByText('Chicken Breast')).toHaveLength(0)
    })
  })

  describe('Sorting', () => {
    it('can sort by expiration date', async () => {
      const user = userEvent.setup()
      const date1 = new Date()
      date1.setDate(date1.getDate() + 10)

      const date2 = new Date()
      date2.setDate(date2.getDate() + 20)

      renderWithItems([
        createPantryItem({ id: 1, food: mockFoods[1], expirationDate: date2, status: 'good' }),
        createPantryItem({ id: 2, food: mockFoods[0], expirationDate: date1, status: 'good' }),
      ])

      await screen.findAllByText('Brown Rice')

      const sortTrigger = screen.getByRole('button', { name: /sort by/i })
      await user.click(sortTrigger)
      const panel = await screen.findByRole('listbox', { hidden: true })
      fireEvent.click(within(panel).getByRole('option', { name: 'Expiration Date', hidden: true }))

      const rows = screen.getAllByRole('row')
      expect(rows[1]).toHaveTextContent('Chicken Breast')
    })
  })

  describe('Bulk Actions', () => {
    it('can select all items', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([
        createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' }),
        createPantryItem({ id: 2, food: mockFoods[1], expirationDate: futureDate, status: 'good' }),
      ])

      await screen.findAllByText('Chicken Breast')

      await user.click(screen.getByRole('checkbox', { name: /select all items/i }))
      expect(screen.getByText('2 item(s) selected')).toBeInTheDocument()
    })

    it('calls the API and removes items from the store on bulk delete', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' })])

      await screen.findAllByText('Chicken Breast')

      await user.click(screen.getAllByRole('checkbox', { name: /select chicken breast/i })[0])
      await user.click(screen.getByRole('button', { name: /delete \(1\)/i }))

      expect(apiDeletePantryItems).toHaveBeenCalledWith([1])
      await waitFor(() => expect(usePantryStore.getState().items).toHaveLength(0))
    })
  })
})
