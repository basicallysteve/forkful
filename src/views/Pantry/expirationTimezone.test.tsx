import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PantryList from './Index'
import PantryStore from './Store'
import { usePantryStore, resetPantryStore } from '@/stores/pantry'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import { useTimezone } from '@/test/withTimezone'
import { formatDisplayDate } from '@/utils/dateHelpers'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/pantry', () => ({
  apiFetchPantryItems: vi.fn(),
  apiCreatePantryItem: vi.fn(),
  apiUpdatePantryItem: vi.fn(),
  apiDeletePantryItem: vi.fn(),
  apiThawPantryItem: vi.fn(),
}))
vi.mock('@/lib/api/foods', () => ({ apiFetchFoods: vi.fn() }))
vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: () => <div />,
}))
vi.mock('@/components/ProductSearch/ProductSearch', () => ({
  default: () => <div />,
}))

import { apiFetchPantryItems } from '@/lib/api/pantry'
import { apiFetchFoods } from '@/lib/api/foods'

const food: Food = {
  id: 1, name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0,
  servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }],
}

// Expiration is a calendar date stored as UTC midnight (what `new Date('2026-12-25')` produces).
const STORED_EXPIRY = new Date('2026-12-25T00:00:00.000Z')

function item(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 1,
    sourceType: 'food',
    food,
    originalSize: { size: 1, unit: 'oz' },
    currentSize: { size: 1, unit: 'oz' },
    expirationDate: STORED_EXPIRY,
    addedDate: new Date(),
    status: 'good',
    frozenDate: null,
    ...overrides,
  } as PantryItem
}

describe('Pantry expiration date in a timezone behind UTC (#315)', () => {
  useTimezone('America/New_York')

  beforeEach(() => {
    resetPantryStore()
    resetFoodStore()
    vi.clearAllMocks()
  })

  it('sanity: the process timezone is behind UTC', () => {
    expect(new Date('2026-12-25T00:00:00.000Z').getDate()).toBe(24)
  })

  it('lists a 12/25/2026 expiration as Dec 25, 2026, not Dec 24', async () => {
    useFoodStore.setState({ foods: [food] })
    vi.mocked(apiFetchPantryItems).mockResolvedValue([item()])
    render(<PantryList />)
    await screen.findAllByText('Chicken Breast')
    expect(screen.getAllByText('Dec 25, 2026').length).toBeGreaterThan(0)
    expect(screen.queryByText('Dec 24, 2026')).not.toBeInTheDocument()
  })

  it('pre-fills the edit form with the stored day so saving does not shift it', () => {
    useFoodStore.setState({ foods: [food] })
    vi.mocked(apiFetchFoods).mockResolvedValue([food])
    usePantryStore.setState({ items: [item()] })
    render(<PantryStore existingItem={item()} />)
    expect(screen.getByLabelText(/expiration date/i)).toHaveValue('2026-12-25')
  })

  it('keeps showing real instants (such as Added dates) in local time', () => {
    expect(formatDisplayDate(new Date('2026-12-25T00:00:00.000Z'))).toBe('Dec 24, 2026')
  })
})
