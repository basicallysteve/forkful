import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingListView from './Index'
import { resetFoodStore } from '@/stores/food'
import { useShoppingListStore, resetShoppingListStore } from '@/stores/shoppingList'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import type { ShoppingListItem } from '@/types/ShoppingList'

vi.mock('@/lib/api/shoppingList', () => ({
  apiCreateShoppingListFoodItem: vi.fn(),
  apiCreateShoppingListProductItem: vi.fn(),
  apiCreateShoppingListFreeformItem: vi.fn(),
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

// A minimal ProductSearch stand-in: an input plus one selectable product option.
vi.mock('@/components/ProductSearch/ProductSearch', () => ({
  default: ({ onChange }: { onChange: (product: Product) => void }) => (
    <div>
      <input aria-label="Shopping list product" readOnly value="" />
      <button
        type="button"
        role="option"
        aria-label="Cereal Box"
        onClick={() => onChange(mockProduct)}
      >
        Cereal Box
      </button>
    </div>
  ),
}))

import {
  apiCreateShoppingListFoodItem,
  apiCreateShoppingListFreeformItem,
  apiCreateShoppingListProductItem,
} from '@/lib/api/shoppingList'

const mockProduct: Product = {
  id: 42,
  name: 'Cereal Box',
  calories: 120,
  protein: 3,
  carbs: 25,
  fat: 1,
  fiber: 2,
  servingSize: 1,
  servingUnit: 'box',
  measurements: [{ unit: 'box' }],
}

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
  // A food line defaults to the first mock food; product/freeform callers pass their own overrides.
  const base: ShoppingListItem = {
    id: 1,
    sourceType: 'food',
    status: 'to_buy',
    name: '',
    food: mockFoods[0],
    amount: 2,
    unit: 'oz',
    addedDate: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
  // Derive the display name from the actual source on the merged item so it can never drift from
  // `food`/`product`/`sourceType`; an explicit `name` override still wins.
  if (overrides.name !== undefined) return base
  const derivedName = base.product?.name ?? base.food?.name ?? ''
  return { ...base, name: derivedName }
}

describe('ShoppingListView', () => {
  beforeEach(() => {
    resetFoodStore()
    resetShoppingListStore()
    vi.clearAllMocks()
  })

  it('hydrates the initial items', async () => {
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[makeItem()]} />)

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
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

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    expect(within(list).getByText('6 pieces')).toBeInTheDocument()
    expect(within(list).getByText('1 piece')).toBeInTheDocument()
    // Standard mass symbols never pluralise.
    expect(within(list).getByText('6 g')).toBeInTheDocument()
  })

  it('lets the user select items, striking them through, and toggles selection off', async () => {
    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const listbox = await screen.findByRole('listbox', { name: 'Shopping list items' })
    const option = within(listbox).getByRole('option')

    // Nothing selected yet.
    expect(listbox.querySelector('.shopping-list-item.is-selected')).toBeNull()

    fireEvent.click(option)
    expect(listbox.querySelector('.shopping-list-item.is-selected')).not.toBeNull()

    // Clicking again clears the selection (metaKeySelection is off, so a plain click toggles).
    fireEvent.click(option)
    expect(listbox.querySelector('.shopping-list-item.is-selected')).toBeNull()
  })

  it('defaults the unit to "each" when the food has no custom unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValue(makeItem({
      id: 2,
      food: mockFoods[1],
      amount: 1,
      unit: 'each',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /brown rice/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFoodItem).toHaveBeenCalledWith({
      foodId: 2,
      amount: 1,
      unit: 'each',
    })
  })

  it('hides the unit picker by default and reveals it via Advanced to override the unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValue(makeItem({
      id: 4,
      food: mockFoods[1],
      amount: 1,
      unit: 'cup',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /brown rice/i }))
    // The unit dropdown is not shown until Advanced is opened.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^advanced$/i }))
    // The dropdown shows the auto-derived default ("each") for a food with no custom unit.
    const unitDropdown = await screen.findByRole('combobox')
    expect(unitDropdown).toHaveTextContent('each')

    // Override it with the food's own unit. (PrimeReact's combobox has pointer-events:none
    // in jsdom, so it must be opened via fireEvent rather than user-event.)
    fireEvent.click(unitDropdown)
    fireEvent.click(await screen.findByRole('option', { name: 'cup', hidden: true }))
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
      unit: 'each',
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
    // The list is now a Listbox whose rows are also role="option", so scope to the search button.
    vi.mocked(apiCreateShoppingListFoodItem).mockResolvedValueOnce(makeItem({ id: 1, amount: 5, unit: 'g' }))
    const searchOption = screen.getAllByRole('option', { name: /chicken breast/i }).find((el) => el.tagName === 'BUTTON')
    await user.click(searchOption!)
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

  it('adds a product via the Product tab, constrained to the product’s unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListProductItem).mockResolvedValue(
      makeItem({ id: 5, sourceType: 'product', name: 'Cereal Box', food: undefined, product: mockProduct, amount: 1, unit: 'box' }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Product' }))
    await user.click(screen.getByRole('option', { name: 'Cereal Box' }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListProductItem).toHaveBeenCalledWith({
      productId: 42,
      amount: 1,
      unit: 'box',
    })

    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(1))
    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    expect(within(list).getByText('Cereal Box')).toBeInTheDocument()
  })

  it('adds a freeform line with no unit via the Freeform tab', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFreeformItem).mockResolvedValue(
      makeItem({ id: 6, sourceType: 'freeform', name: 'Trash bags', food: undefined, amount: 1, unit: null }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Freeform' }))
    await user.type(screen.getByLabelText('Shopping list item name'), 'Trash bags')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFreeformItem).toHaveBeenCalledWith({
      name: 'Trash bags',
      amount: 1,
      unit: undefined,
    })

    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(1))
    // A freeform line with no unit and amount 1 shows just its name.
    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    expect(within(list).getByText('Trash bags')).toBeInTheDocument()
  })

  it('sends the freeform unit when one is provided', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListFreeformItem).mockResolvedValue(
      makeItem({ id: 7, sourceType: 'freeform', name: 'Foil', food: undefined, amount: 1, unit: 'roll' }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Freeform' }))
    await user.type(screen.getByLabelText('Shopping list item name'), 'Foil')
    await user.type(screen.getByLabelText('Shopping list freeform unit'), 'roll')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListFreeformItem).toHaveBeenCalledWith({
      name: 'Foil',
      amount: 1,
      unit: 'roll',
    })
  })

  it('disables Add Item on the Freeform tab until a name is entered', async () => {
    const user = userEvent.setup()
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Freeform' }))
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()

    await user.type(screen.getByLabelText('Shopping list item name'), 'Napkins')
    expect(screen.getByRole('button', { name: /add item/i })).toBeEnabled()
  })

  it('collapses the Advanced unit picker when switching variants', async () => {
    const user = userEvent.setup()
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.click(screen.getByRole('button', { name: /^advanced$/i }))
    expect(await screen.findByRole('combobox')).toBeInTheDocument()

    // Switching to Product starts from a clean state — the override is collapsed again.
    await user.click(screen.getByRole('tab', { name: 'Product' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders all three source variants together', async () => {
    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[
          makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' }),
          makeItem({ id: 2, sourceType: 'product', name: 'Cereal Box', food: undefined, product: mockProduct, amount: 1, unit: 'box' }),
          makeItem({ id: 3, sourceType: 'freeform', name: 'Trash bags', food: undefined, amount: 1, unit: null }),
        ]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    expect(within(list).getByText('Chicken Breast')).toBeInTheDocument()
    expect(within(list).getByText('Cereal Box')).toBeInTheDocument()
    expect(within(list).getByText('Trash bags')).toBeInTheDocument()
  })
})
