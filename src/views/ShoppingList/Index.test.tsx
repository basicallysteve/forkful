import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingListView from './Index'
import { resetFoodStore } from '@/stores/food'
import { useShoppingListStore, resetShoppingListStore } from '@/stores/shoppingList'
import type { Food } from '@/types/Food'
import type { ShoppingListItem } from '@/types/ShoppingList'

vi.mock('@/lib/api/shoppingList', () => ({
  apiCreateShoppingListFoodItem: vi.fn(),
}))

vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: ({ onChange, onInputChange, value, localFoods }: {
    onChange: (food: Food) => void
    onInputChange?: (value: string) => void
    value: string
    localFoods: Food[]
  }) => (
    <div>
      <input
        aria-label="Shopping list food"
        value={value}
        onChange={(e) => onInputChange?.(e.target.value)}
      />
      {localFoods.map((food) => (
        <button key={food.id} type="button" role="option" aria-label={food.name} onClick={() => onChange(food)}>
          {food.name}
        </button>
      ))}
    </div>
  ),
}))

import { apiCreateShoppingListFoodItem } from '@/lib/api/shoppingList'

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
    measurements: [{ unit: 'cup' }],
  },
  {
    id: 3,
    name: 'Lime',
    calories: 20,
    protein: 0.5,
    carbs: 7,
    fat: 0.1,
    fiber: 1.9,
    servingSize: 100,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }, { unit: 'piece' }],
  },
]

function makeItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id: 1,
    sourceType: 'food',
    status: 'to_buy',
    food: mockFoods[0],
    amount: 2,
    unit: 'oz',
    addedDate: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('ShoppingListView', () => {
  beforeEach(() => {
    resetFoodStore()
    resetShoppingListStore()
    vi.clearAllMocks()
  })

  it('hydrates the initial items', async () => {
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[makeItem()]} />)

    const list = await screen.findByRole('list', { name: 'Shopping list items' })
    expect(within(list).getByText('Chicken Breast')).toBeInTheDocument()
    expect(within(list).getByText('2 oz')).toBeInTheDocument()
    expect(screen.queryByText(/Source:/)).not.toBeInTheDocument()
  })

  it('pluralises custom units by amount but leaves standard units unchanged', async () => {
    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[
          makeItem({ id: 1, food: mockFoods[2], amount: 6, unit: 'piece' }),
          makeItem({ id: 2, food: mockFoods[2], amount: 1, unit: 'piece' }),
          makeItem({ id: 3, food: mockFoods[2], amount: 6, unit: 'g' }),
        ]}
      />,
    )

    const list = await screen.findByRole('list', { name: 'Shopping list items' })
    expect(within(list).getByText('6 pieces')).toBeInTheDocument()
    expect(within(list).getByText('1 piece')).toBeInTheDocument()
    // Standard mass symbols never pluralise.
    expect(within(list).getByText('6 g')).toBeInTheDocument()
  })

  it('defaults the unit to the serving unit when the food has no custom unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValue(makeItem({
      id: 2,
      food: mockFoods[1],
      amount: 1,
      unit: 'cup',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /brown rice/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFoodItem).toHaveBeenCalledWith({
      foodId: 2,
      amount: 1,
      unit: 'cup',
    })
  })

  it('defaults the unit to the food’s custom unit when it has one', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValue(makeItem({
      id: 3,
      food: mockFoods[2],
      amount: 1,
      unit: 'piece',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /lime/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFoodItem).toHaveBeenCalledWith({
      foodId: 3,
      amount: 1,
      unit: 'piece',
    })
  })

  it('creates a food item and adds it to the store', async () => {
    const user = userEvent.setup()
    const createdItem = makeItem()
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValue(createdItem)

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /amount/i }))
    await user.type(screen.getByRole('spinbutton', { name: /amount/i }), '2')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFoodItem).toHaveBeenCalledWith({
      foodId: 1,
      amount: 2,
      unit: 'g',
    })

    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(1))
    expect(useShoppingListStore.getState().items[0].status).toBe('to_buy')
  })

  it('replaces the line in place when the server merges a duplicate', async () => {
    const user = userEvent.setup()
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    // First add → a new line (id 1, amount 2).
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValueOnce(makeItem({ id: 1, amount: 2, unit: 'g' }))
    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))
    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(1))

    // Second add of the same food → server merges and returns the SAME id with a summed amount.
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValueOnce(makeItem({ id: 1, amount: 5, unit: 'g' }))
    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    await waitFor(() => expect(useShoppingListStore.getState().items[0].amount).toBe(5))
    expect(useShoppingListStore.getState().items).toHaveLength(1)
  })

  it('disables Add Item when the selected food is cleared from the search', async () => {
    const user = userEvent.setup()
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    expect(screen.getByRole('button', { name: /add item/i })).toBeEnabled()

    await user.clear(screen.getByLabelText('Shopping list food'))

    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
  })
})
