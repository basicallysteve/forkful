import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryList from './Index'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/pantry', () => ({
  apiFetchPantryItems: vi.fn(),
  apiDeletePantryItem: vi.fn().mockResolvedValue(undefined),
  apiDeletePantryItems: vi.fn().mockResolvedValue([1]),
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
    measurements: [{ unit: 'g' }, { unit: 'oz' }],
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
    measurements: [{ unit: 'cup' }, { unit: 'g' }],
  },
]

function createPantryItem(overrides: Partial<PantryItem> & { id: number; food: Food }): PantryItem {
  return {
    sourceType: 'food',
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
      expect(document.querySelector('.p-tag.p-tag-success')).toHaveTextContent('Good')
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

  describe('Mobile cards', () => {
    function cardFor(name: string): HTMLElement {
      const card = [...document.querySelectorAll<HTMLElement>('.pantry-card')].find((c) => c.textContent?.includes(name))
      if (!card) throw new Error(`no card for ${name}`)
      return card
    }

    it('shows Freeze, Edit and Delete in every card, named after the item', async () => {
      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], status: 'good' })])
      await screen.findAllByText('Chicken Breast')

      const card = within(cardFor('Chicken Breast'))
      expect(card.getByRole('button', { name: 'Freeze Chicken Breast' })).toBeInTheDocument()
      expect(card.getByRole('link', { name: 'Edit Chicken Breast' })).toHaveAttribute('href', '/pantry/1/edit')
      expect(card.getByRole('button', { name: 'Delete Chicken Breast' })).toBeInTheDocument()
    })

    it('shows Thaw instead of Freeze for a frozen item', async () => {
      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], status: 'good', frozenDate: new Date() })])
      await screen.findAllByText('Chicken Breast')

      const card = within(cardFor('Chicken Breast'))
      expect(card.getByRole('button', { name: 'Thaw Chicken Breast' })).toBeInTheDocument()
      expect(card.queryByRole('button', { name: /^Freeze/ })).not.toBeInTheDocument()
    })

    it('keeps Delete in its own danger element, apart from Freeze and Edit', async () => {
      renderWithItems([createPantryItem({ id: 1, food: mockFoods[0], status: 'good' })])
      await screen.findAllByText('Chicken Breast')

      const card = cardFor('Chicken Breast')
      const group = card.querySelector('.card-actions-group') as HTMLElement
      const del = within(card).getByRole('button', { name: 'Delete Chicken Breast' })
      expect(del).toHaveClass('card-action-delete')
      expect(group).not.toContainElement(del)
      expect(within(group).getByRole('button', { name: 'Freeze Chicken Breast' })).toBeInTheDocument()
      expect(within(group).getByRole('link', { name: 'Edit Chicken Breast' })).toBeInTheDocument()
    })
  })

  describe('Delete with undo', () => {
    const future = new Date(Date.now() + 30 * 86400000)
    const two = () => [
      createPantryItem({ id: 1, food: mockFoods[0], expirationDate: future }),
      createPantryItem({ id: 2, food: mockFoods[1], expirationDate: future }),
    ]
    const rowNames = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(apiDeletePantryItem).mockResolvedValue(undefined)
      vi.mocked(apiDeletePantryItems).mockResolvedValue([1, 2])
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    async function loaded(items: PantryItem[]) {
      renderWithItems(items)
      await screen.findAllByText('Chicken Breast')
    }
    const clickDelete = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Delete ${name}` }))

    it('removes the item from the list at once and shows an undo toast, sending nothing yet', async () => {
      await loaded(two())
      clickDelete('Chicken Breast')

      expect(screen.getByRole('status')).toHaveTextContent('Deleted Chicken Breast')
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(rowNames().join('|')).not.toContain('Chicken Breast')
      expect(apiDeletePantryItem).not.toHaveBeenCalled()
    })

    it('Undo restores the item in the same position and sends nothing', async () => {
      await loaded(two())
      clickDelete('Chicken Breast')
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

      const names = rowNames()
      expect(names[0]).toContain('Chicken Breast')
      expect(names[1]).toContain('Brown Rice')
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(10000) })
      expect(apiDeletePantryItem).not.toHaveBeenCalled()
      expect(usePantryStore.getState().items).toHaveLength(2)
    })

    it('sends exactly one delete when the toast expires and then drops the item from the store', async () => {
      await loaded(two())
      clickDelete('Chicken Breast')
      await act(async () => { vi.advanceTimersByTime(7000) })

      expect(apiDeletePantryItem).toHaveBeenCalledTimes(1)
      expect(apiDeletePantryItem).toHaveBeenCalledWith(1)
      await waitFor(() => expect(usePantryStore.getState().items.map((i) => i.id)).toEqual([2]))
      expect(screen.queryByRole('status')).not.toHaveTextContent('Deleted')
    })

    it('shows one toast for a bulk delete and Undo restores all of them', async () => {
      await loaded(two())
      fireEvent.click(screen.getByRole('checkbox', { name: /select all items/i }))
      fireEvent.click(screen.getByRole('button', { name: /delete \(2\)/i }))

      expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1)
      expect(screen.getByRole('status')).toHaveTextContent('Deleted 2 items')
      expect(screen.getByText('No pantry items found.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(rowNames()).toHaveLength(2)
      act(() => { vi.advanceTimersByTime(10000) })
      expect(apiDeletePantryItems).not.toHaveBeenCalled()
    })

    it('sends one bulk request when the bulk toast expires', async () => {
      await loaded(two())
      fireEvent.click(screen.getByRole('checkbox', { name: /select all items/i }))
      fireEvent.click(screen.getByRole('button', { name: /delete \(2\)/i }))
      await act(async () => { vi.advanceTimersByTime(7000) })

      expect(apiDeletePantryItems).toHaveBeenCalledTimes(1)
      expect(apiDeletePantryItems).toHaveBeenCalledWith([1, 2])
      await waitFor(() => expect(usePantryStore.getState().items).toHaveLength(0))
    })

    it('restores the item and shows the error message when the delete fails', async () => {
      vi.mocked(apiDeletePantryItem).mockRejectedValue(new Error('nope'))
      await loaded(two())
      clickDelete('Chicken Breast')
      await act(async () => { vi.advanceTimersByTime(7000) })

      expect(await screen.findByText('Failed to delete item. Please try again.')).toBeInTheDocument()
      expect(rowNames()[0]).toContain('Chicken Breast')
      expect(usePantryStore.getState().items).toHaveLength(2)
    })

    it('still works when a second item is deleted while a toast is showing', async () => {
      await loaded(two())
      clickDelete('Chicken Breast')
      clickDelete('Brown Rice')
      expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2)

      fireEvent.click(screen.getAllByRole('button', { name: 'Undo' })[0])
      await act(async () => { vi.advanceTimersByTime(7000) })

      expect(apiDeletePantryItem).toHaveBeenCalledTimes(1)
      expect(apiDeletePantryItem).toHaveBeenCalledWith(2)
      expect(rowNames()[0]).toContain('Chicken Breast')
    })

    it('works from the row actions menu too', async () => {
      await loaded(two())
      fireEvent.click(screen.getAllByRole('button', { name: /more actions/i })[0])
      fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))
      expect(screen.getByRole('status')).toHaveTextContent('Deleted Chicken Breast')
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
    it('re-fetches with search param when user types in search box', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const chickenOnly = [createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' })]
      vi.mocked(apiFetchPantryItems)
        .mockResolvedValueOnce([
          createPantryItem({ id: 1, food: mockFoods[0], expirationDate: futureDate, status: 'good' }),
          createPantryItem({ id: 2, food: mockFoods[1], expirationDate: futureDate, status: 'good' }),
        ])
        .mockResolvedValueOnce(chickenOnly)

      renderWithItems()
      await screen.findAllByText('Chicken Breast')

      await user.type(screen.getByPlaceholderText('Search pantry items...'), 'Chicken')

      await waitFor(() =>
        expect(apiFetchPantryItems).toHaveBeenCalledWith(expect.objectContaining({ search: 'Chicken' }))
      )
      await waitFor(() => expect(screen.queryAllByText('Brown Rice')).toHaveLength(0))
    })

    it('re-fetches with status param when status filter changes', async () => {
      const user = userEvent.setup()
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)
      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      const goodOnly = [createPantryItem({ id: 2, food: mockFoods[1], expirationDate: goodDate, status: 'good' })]
      vi.mocked(apiFetchPantryItems)
        .mockResolvedValueOnce([
          createPantryItem({ id: 1, food: mockFoods[0], expirationDate: expiredDate, status: 'expired' }),
          createPantryItem({ id: 2, food: mockFoods[1], expirationDate: goodDate, status: 'good' }),
        ])
        .mockResolvedValueOnce(goodOnly)

      renderWithItems()
      await screen.findAllByText('Brown Rice')

      const statusTrigger = screen.getByRole('button', { name: /filter by status/i })
      await user.click(statusTrigger)
      fireEvent.click(await screen.findByRole('option', { name: 'Good', hidden: true }))

      await waitFor(() =>
        expect(apiFetchPantryItems).toHaveBeenCalledWith(expect.objectContaining({ status: 'good' }))
      )
      await waitFor(() => expect(screen.queryAllByText('Chicken Breast')).toHaveLength(0))
    })
  })

  describe('Sorting', () => {
    it('re-fetches with sortBy param when sort option changes', async () => {
      const user = userEvent.setup()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      // Second call returns items in alphabetical order (name sort)
      vi.mocked(apiFetchPantryItems)
        .mockResolvedValueOnce([
          createPantryItem({ id: 1, food: mockFoods[1], expirationDate: futureDate, status: 'good' }),
          createPantryItem({ id: 2, food: mockFoods[0], expirationDate: futureDate, status: 'good' }),
        ])
        .mockResolvedValueOnce([
          createPantryItem({ id: 2, food: mockFoods[0], expirationDate: futureDate, status: 'good' }),
          createPantryItem({ id: 1, food: mockFoods[1], expirationDate: futureDate, status: 'good' }),
        ])

      renderWithItems()
      await screen.findAllByText('Brown Rice')

      const sortTrigger = screen.getByRole('button', { name: /sort by/i })
      await user.click(sortTrigger)
      const panel = await screen.findByRole('listbox', { hidden: true })
      fireEvent.click(within(panel).getByRole('option', { name: 'Name', hidden: true }))

      await waitFor(() =>
        expect(apiFetchPantryItems).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'name' }))
      )
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows[1]).toHaveTextContent('Chicken Breast')
      })
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
  })
})
