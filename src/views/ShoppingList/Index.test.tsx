import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingListView from './Index'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import { useShoppingListStore, resetShoppingListStore } from '@/stores/shoppingList'
import type { Food } from '@/types/Food'
import type { ShoppingListItem } from '@/types/ShoppingList'

vi.mock('@/lib/api/shoppingList', () => ({
  apiCreateShoppingListFoodItem: vi.fn(),
}))

vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: ({ onChange, value, localFoods }: {
    onChange: (food: Food) => void
    value: string
    localFoods: Food[]
  }) => (
    <div>
      <input aria-label="Shopping list food" value={value} readOnly />
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

    expect(await screen.findByRole('heading', { name: 'Chicken Breast' })).toBeInTheDocument()
    expect(screen.getByText('Source: food')).toBeInTheDocument()
    expect(screen.getByText('Status: to_buy')).toBeInTheDocument()
  })

  it('defaults the unit from the selected food measurements', async () => {
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
})
