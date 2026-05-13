import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import EditPantryItemPage from './page'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import { useParams, notFound } from 'next/navigation'
import { apiFetchPantryItem } from '@/lib/api/pantry'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/pantry', () => ({
  apiFetchPantryItem: vi.fn(),
  apiCreatePantryItem: vi.fn(),
  apiUpdatePantryItem: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn().mockResolvedValue([]),
}))

const mockFood: Food = {
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
}

function makeItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 1,
    food: mockFood,
    originalSize: { size: 16, unit: 'oz' },
    currentSize: { size: 8, unit: 'oz' },
    expirationDate: null,
    addedDate: new Date('2026-01-01'),
    status: 'good',
    frozenDate: null,
    ...overrides,
  }
}

beforeEach(() => {
  resetPantryStore()
  resetFoodStore()
  vi.clearAllMocks()
  useFoodStore.setState({ foods: [mockFood] })
  ;(useParams as Mock).mockReturnValue({ id: '1' })
  // Re-install the throwing implementation; the next-navigation mock defines it
  // once at module load, and previous tests in this file may have overridden it.
  ;(notFound as Mock).mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND')
  })
})

describe('Edit Pantry Item Page — fetch fallback', () => {
  it('uses the item from the store without calling the API when present', async () => {
    const item = makeItem()
    usePantryStore.setState({ items: [item] })

    render(<EditPantryItemPage />)

    expect(await screen.findByText('Edit Pantry Item')).toBeInTheDocument()
    expect(apiFetchPantryItem).not.toHaveBeenCalled()
  })

  it('shows a blank loading state and then fetches from the API when item is not in the store', async () => {
    usePantryStore.setState({ items: [] })
    let resolveFetch: (value: PantryItem) => void = () => {}
    ;(apiFetchPantryItem as Mock).mockReturnValue(new Promise<PantryItem>((resolve) => {
      resolveFetch = resolve
    }))

    const { container } = render(<EditPantryItemPage />)

    // Initial render is null while fetch is in flight
    expect(container.firstChild).toBeNull()
    expect(apiFetchPantryItem).toHaveBeenCalledWith(1)

    resolveFetch(makeItem())

    expect(await screen.findByText('Edit Pantry Item')).toBeInTheDocument()
  })

  it('calls notFound() when the API returns null (item does not exist or not owned)', async () => {
    usePantryStore.setState({ items: [] })
    ;(apiFetchPantryItem as Mock).mockResolvedValue(null)
    // Don't throw — we only care that notFound was invoked, and the async
    // rerender would otherwise produce an uncaught NEXT_NOT_FOUND error.
    ;(notFound as Mock).mockImplementation(() => undefined as never)

    render(<EditPantryItemPage />)

    await waitFor(() => expect(notFound).toHaveBeenCalled())
    expect(apiFetchPantryItem).toHaveBeenCalledWith(1)
  })

  it('calls notFound() when the API rejects', async () => {
    usePantryStore.setState({ items: [] })
    ;(apiFetchPantryItem as Mock).mockRejectedValue(new Error('network'))
    ;(notFound as Mock).mockImplementation(() => undefined as never)

    render(<EditPantryItemPage />)

    await waitFor(() => expect(notFound).toHaveBeenCalled())
    expect(apiFetchPantryItem).toHaveBeenCalledWith(1)
  })

  it('calls notFound() immediately when the id param is not a finite integer', () => {
    ;(useParams as Mock).mockReturnValue({ id: 'not-a-number' })

    expect(() => render(<EditPantryItemPage />)).toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
    expect(apiFetchPantryItem).not.toHaveBeenCalled()
  })
})
