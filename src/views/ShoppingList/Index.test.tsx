import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingListView, { buildShoppingListText, formatPrice, groupExpirationPortions, resolveLinePriceTotal } from './Index'
import { formatUtcDateForInput } from '@/utils/dateHelpers'
import { resetFoodStore } from '@/stores/food'
import { useShoppingListStore, resetShoppingListStore } from '@/stores/shoppingList'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import type { ShoppingListItem } from '@/types/ShoppingList'

vi.mock('@/lib/api/shoppingList', () => ({
  apiCreateShoppingListItem: vi.fn(),
  apiDeleteShoppingListItem: vi.fn(),
  apiUpdateShoppingListItemStatus: vi.fn(),
  apiUpdateShoppingListItemDetails: vi.fn(),
  apiSplitShoppingListItem: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn(),
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

import { apiCreateShoppingListItem, apiDeleteShoppingListItem, apiSplitShoppingListItem, apiUpdateShoppingListItemDetails, apiUpdateShoppingListItemStatus } from '@/lib/api/shoppingList'
import { apiFetchFoods } from '@/lib/api/foods'

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
    linePrice: null,
    expirationDate: null,
    addedDate: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
  // Derive the display name from the actual source on the merged item so it can never drift from
  // `food`/`product`/`sourceType`; an explicit `name` override still wins.
  if (overrides.name !== undefined) return base
  const derivedName = base.product?.name ?? base.food?.name ?? ''
  return { ...base, name: derivedName }
}

// Drive react-swipeable with a deliberate left drag (well past its 40px delta). It listens via native
// touch listeners, so fireEvent's real DOM events reach it.
function swipeLeft(el: HTMLElement) {
  fireEvent.touchStart(el, { touches: [{ clientX: 220, clientY: 10 }] })
  fireEvent.touchMove(el, { touches: [{ clientX: 140, clientY: 10 }] })
  fireEvent.touchMove(el, { touches: [{ clientX: 40, clientY: 10 }] })
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 40, clientY: 10 }] })
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

  it('lazily loads the food catalog in the background when none is provided', async () => {
    vi.mocked(apiFetchFoods).mockResolvedValue(mockFoods)

    render(<ShoppingListView initialItems={[]} />)

    // The catalog is fetched off the render path and populates FoodSearch's instant suggestions.
    await waitFor(() => expect(apiFetchFoods).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('option', { name: /chicken breast/i })).toBeInTheDocument()
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

  it('checks a line off as bought by selecting the row, striking it through, and back to to_buy', async () => {
    vi.mocked(apiUpdateShoppingListItemStatus).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    const row = within(list).getByRole('option')

    // Selecting the row marks the line bought and strikes it through.
    fireEvent.click(row)
    expect(apiUpdateShoppingListItemStatus).toHaveBeenCalledWith(1, 'bought')
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('bought'))
    expect(list.querySelector('.shopping-list-item.status-bought')).not.toBeNull()

    // Deselecting returns it to to_buy (never unavailable).
    fireEvent.click(within(list).getByRole('option'))
    expect(apiUpdateShoppingListItemStatus).toHaveBeenLastCalledWith(1, 'to_buy')
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('to_buy'))
    expect(list.querySelector('.shopping-list-item.status-bought')).toBeNull()
  })

  it('marks a line unavailable via the kebab menu, shows the pill, and reverts to to_buy', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemStatus).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })

    await user.click(screen.getByRole('button', { name: 'More actions for Chicken Breast' }))
    // PrimeReact's overlay stays aria-hidden in jsdom (its transition never completes), so query the
    // menu item with { hidden: true }, mirroring the Advanced dropdown test.
    fireEvent.click(await screen.findByRole('menuitem', { name: /mark unavailable/i, hidden: true }))

    expect(apiUpdateShoppingListItemStatus).toHaveBeenCalledWith(1, 'unavailable')
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('unavailable'))
    expect(within(list).getByText('Unavailable')).toBeInTheDocument()
    // Opening the menu did not toggle the row's selection into `bought`.
    expect(list.querySelector('.shopping-list-item.status-bought')).toBeNull()

    // The menu now offers the way back to to_buy.
    await user.click(screen.getByRole('button', { name: 'More actions for Chicken Breast' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /mark to buy/i, hidden: true }))
    expect(apiUpdateShoppingListItemStatus).toHaveBeenLastCalledWith(1, 'to_buy')
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('to_buy'))
    expect(within(list).queryByText('Unavailable')).not.toBeInTheDocument()
  })

  it('selecting an unavailable line marks it bought (any not-bought → bought)', async () => {
    vi.mocked(apiUpdateShoppingListItemStatus).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', status: 'unavailable' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    fireEvent.click(within(list).getByRole('option'))

    expect(apiUpdateShoppingListItemStatus).toHaveBeenCalledWith(1, 'bought')
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('bought'))
  })

  it('rolls the status back and shows an error when the update fails', async () => {
    vi.mocked(apiUpdateShoppingListItemStatus).mockRejectedValue(new Error('network'))

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    fireEvent.click(within(list).getByRole('option'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to update/i)
    // The optimistic flip is reverted — the line is back to to_buy.
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('to_buy'))
    expect(list.querySelector('.shopping-list-item.status-bought')).toBeNull()
  })

  it('defaults the unit to "each" when the food has no custom unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(makeItem({
      id: 2,
      food: mockFoods[1],
      amount: 1,
      unit: 'each',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /brown rice/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'food',
      foodId: 2,
      amount: 1,
      unit: 'each',
    })
  })

  it('hides the unit picker by default and reveals it via Advanced to override the unit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(makeItem({
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

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'food',
      foodId: 2,
      amount: 1,
      unit: 'cup',
    })
  })

  it('defaults the unit to the food’s custom unit when it has one', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(makeItem({
      id: 3,
      food: mockFoods[2],
      amount: 1,
      unit: 'piece',
    }))

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /lime/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'food',
      foodId: 3,
      amount: 1,
      unit: 'piece',
    })
  })

  it('creates a food item and adds it to the store', async () => {
    const user = userEvent.setup()
    const createdItem = makeItem()
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(createdItem)

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.clear(screen.getByRole('spinbutton', { name: /amount/i }))
    await user.type(screen.getByRole('spinbutton', { name: /amount/i }), '2')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'food',
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
    vi.mocked(apiCreateShoppingListItem).mockResolvedValueOnce(makeItem({ id: 1, amount: 2, unit: 'g' }))
    await user.click(screen.getByRole('option', { name: /chicken breast/i }))
    await user.click(screen.getByRole('button', { name: /add item/i }))
    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(1))

    // Second add of the same food → server merges and returns the SAME id with a summed amount.
    // The list is a Listbox whose rows are also role="option", so scope to the search button.
    vi.mocked(apiCreateShoppingListItem).mockResolvedValueOnce(makeItem({ id: 1, amount: 5, unit: 'g' }))
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
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(
      makeItem({ id: 5, sourceType: 'product', name: 'Cereal Box', food: undefined, product: mockProduct, amount: 1, unit: 'box' }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Product' }))
    await user.click(screen.getByRole('option', { name: 'Cereal Box' }))
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'product',
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
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(
      makeItem({ id: 6, sourceType: 'freeform', name: 'Trash bags', food: undefined, amount: 1, unit: null }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Freeform' }))
    await user.type(screen.getByLabelText('Shopping list item name'), 'Trash bags')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'freeform',
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
    vi.mocked(apiCreateShoppingListItem).mockResolvedValue(
      makeItem({ id: 7, sourceType: 'freeform', name: 'Foil', food: undefined, amount: 1, unit: 'roll' }),
    )

    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    await user.click(screen.getByRole('tab', { name: 'Freeform' }))
    await user.type(screen.getByLabelText('Shopping list item name'), 'Foil')
    await user.type(screen.getByLabelText('Shopping list freeform unit'), 'roll')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(apiCreateShoppingListItem).toHaveBeenCalledWith({
      sourceType: 'freeform',
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

  it('removes an item: calls the API with its id and drops it from the store', async () => {
    const user = userEvent.setup()
    vi.mocked(apiDeleteShoppingListItem).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[
          makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' }),
          makeItem({ id: 2, food: mockFoods[1], amount: 1, unit: 'cup' }),
        ]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    await user.click(within(list).getByRole('button', { name: 'Remove Chicken Breast' }))

    expect(apiDeleteShoppingListItem).toHaveBeenCalledWith(1)
    await waitFor(() => expect(useShoppingListStore.getState().items).toEqual([
      expect.objectContaining({ id: 2 }),
    ]))
    // The other line is untouched.
    expect(within(list).getByText('Brown Rice')).toBeInTheDocument()
    expect(within(list).queryByText('Chicken Breast')).not.toBeInTheDocument()
  })

  it('removes an item via the kebab menu (the desktop delete path)', async () => {
    const user = userEvent.setup()
    vi.mocked(apiDeleteShoppingListItem).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[
          makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' }),
          makeItem({ id: 2, food: mockFoods[1], amount: 1, unit: 'cup' }),
        ]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    await user.click(screen.getByRole('button', { name: 'More actions for Chicken Breast' }))
    // PrimeReact's overlay stays aria-hidden in jsdom, so query the menu item with { hidden: true }.
    fireEvent.click(await screen.findByRole('menuitem', { name: /remove/i, hidden: true }))

    expect(apiDeleteShoppingListItem).toHaveBeenCalledWith(1)
    await waitFor(() => expect(useShoppingListStore.getState().items).toEqual([
      expect.objectContaining({ id: 2 }),
    ]))
    expect(within(list).queryByText('Chicken Breast')).not.toBeInTheDocument()
  })

  it('removing does not toggle the row into bought', async () => {
    const user = userEvent.setup()
    vi.mocked(apiDeleteShoppingListItem).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    await user.click(within(list).getByRole('button', { name: 'Remove Chicken Breast' }))

    // The Remove click is stopped from bubbling, so it never toggles the Listbox selection.
    expect(apiUpdateShoppingListItemStatus).not.toHaveBeenCalled()
  })

  it('opens the row on a left swipe, then removes it on a second left swipe', async () => {
    vi.mocked(apiDeleteShoppingListItem).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    const row = list.querySelector('.shopping-list-row') as HTMLElement

    // First swipe reveals Remove but does not delete.
    swipeLeft(row)
    await waitFor(() => expect(row.className).toContain('is-open'))
    expect(apiDeleteShoppingListItem).not.toHaveBeenCalled()

    // Second swipe on the open row commits the delete.
    swipeLeft(row)
    expect(apiDeleteShoppingListItem).toHaveBeenCalledWith(1)
    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(0))
  })

  it('keeps the item and shows an error when the remove request fails', async () => {
    const user = userEvent.setup()
    vi.mocked(apiDeleteShoppingListItem).mockRejectedValue(new Error('network'))

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )

    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    await user.click(within(list).getByRole('button', { name: 'Remove Chicken Breast' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to remove/i)
    // The line is still on the list — nothing was optimistically dropped.
    expect(useShoppingListStore.getState().items).toHaveLength(1)
    expect(within(list).getByText('Chicken Breast')).toBeInTheDocument()
  })

  it('copies the list to the clipboard and confirms with “Copied!”', async () => {
    const user = userEvent.setup()

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[
          makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' }),
          makeItem({ id: 2, sourceType: 'freeform', name: 'Trash bags', food: undefined, amount: 1, unit: null }),
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: /share/i }))

    expect(await navigator.clipboard.readText()).toBe(
      [
        "Hey! I'm sending you my shopping list from EatForkful — you should check it out!",
        '',
        '- Chicken Breast — 2 oz',
        '- Trash bags',
        '',
        'Build your own shopping list at eatforkful.com',
      ].join('\n'),
    )
    // The button flips to a confirmation after a successful copy.
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('disables Share when the list is empty', async () => {
    render(<ShoppingListView initialFoods={mockFoods} initialItems={[]} />)

    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled()
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

describe('buildShoppingListText', () => {
  it('wraps a bulleted list in the marketable intro and CTA, mirroring on-screen quantities', () => {
    const text = buildShoppingListText([
      makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' }),
      makeItem({ id: 2, food: mockFoods[2], amount: 6, unit: 'piece' }),
      makeItem({ id: 3, sourceType: 'freeform', name: 'Trash bags', food: undefined, amount: 1, unit: null }),
    ])

    expect(text).toBe(
      [
        "Hey! I'm sending you my shopping list from EatForkful — you should check it out!",
        '',
        '- Chicken Breast — 2 oz',
        '- Lime — 6 pieces', // custom units pluralise by amount
        '- Trash bags', // a bare "1" with no unit carries no quantity
        '',
        'Build your own shopping list at eatforkful.com',
      ].join('\n'),
    )
  })
})

describe('resolveLinePriceTotal', () => {
  it('carries a total straight through, rounded to 2 decimals', () => {
    expect(resolveLinePriceTotal('total', 4.5, 3)).toBe(4.5)
    expect(resolveLinePriceTotal('total', 4.005, 3)).toBe(4.01)
  })

  it('multiplies a per-unit price by the quantity', () => {
    expect(resolveLinePriceTotal('per_unit', 1.5, 4)).toBe(6)
    // 0.1 × 3 would drift to 0.30000000000000004 without rounding.
    expect(resolveLinePriceTotal('per_unit', 0.1, 3)).toBe(0.3)
  })

  it('returns null for an empty value in either mode', () => {
    expect(resolveLinePriceTotal('total', null, 2)).toBeNull()
    expect(resolveLinePriceTotal('per_unit', null, 2)).toBeNull()
  })
})

describe('formatPrice', () => {
  it('formats a total with a currency symbol and two decimals', () => {
    expect(formatPrice(4.5)).toBe('$4.50')
    expect(formatPrice(12)).toBe('$12.00')
  })
})

describe('groupExpirationPortions', () => {
  // A Calendar value is a local Date; the helper normalises to UTC-midnight for both grouping and output.
  const augFirst = new Date(2026, 7, 1)
  const augTenth = new Date(2026, 7, 10)

  it('keeps portions with distinct dates as separate groups', () => {
    const groups = groupExpirationPortions([
      { amount: 2, date: augFirst },
      { amount: 3, date: augTenth },
    ])
    expect(groups).toEqual([
      { amount: 2, expirationDate: new Date(Date.UTC(2026, 7, 1)) },
      { amount: 3, expirationDate: new Date(Date.UTC(2026, 7, 10)) },
    ])
  })

  it('merges portions that share a calendar day, summing their amounts', () => {
    const groups = groupExpirationPortions([
      { amount: 2, date: augFirst },
      { amount: 1, date: new Date(2026, 7, 1, 18, 30) }, // same day, later local time
    ])
    expect(groups).toEqual([{ amount: 3, expirationDate: new Date(Date.UTC(2026, 7, 1)) }])
  })

  it('treats undated portions as their own group and drops non-positive amounts', () => {
    const groups = groupExpirationPortions([
      { amount: 2, date: augFirst },
      { amount: 1, date: null },
      { amount: 0, date: augTenth },
    ])
    expect(groups).toEqual([
      { amount: 2, expirationDate: new Date(Date.UTC(2026, 7, 1)) },
      { amount: 1, expirationDate: null },
    ])
  })
})

describe('ShoppingListView — price & expiration', () => {
  async function openDetailsDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'More actions for Chicken Breast' }))
    // The kebab menu portals and stays aria-hidden in jsdom, mirroring the status-menu tests.
    fireEvent.click(await screen.findByRole('menuitem', { name: /price & expiration/i, hidden: true }))
    return screen.findByRole('dialog')
  }

  it('opens the details dialog automatically once a line is checked off as bought', async () => {
    vi.mocked(apiUpdateShoppingListItemStatus).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )
    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })

    // No dialog until a line is actually checked off.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(within(list).getByRole('option'))

    // The check-off persists first, then the Price & expiration dialog surfaces for that line.
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('bought'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('does not open the dialog when a line is marked unavailable or unchecked', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemStatus).mockResolvedValue(undefined)

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', status: 'bought' })]}
      />,
    )
    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })

    // Unchecking a bought line (→ to_buy) never prompts.
    fireEvent.click(within(list).getByRole('option'))
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('to_buy'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Marking a line unavailable via the kebab never prompts either.
    await user.click(screen.getByRole('button', { name: 'More actions for Chicken Breast' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /mark unavailable/i, hidden: true }))
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('unavailable'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not open the dialog when the check-off fails to persist', async () => {
    vi.mocked(apiUpdateShoppingListItemStatus).mockRejectedValue(new Error('network'))

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )
    const list = await screen.findByRole('listbox', { name: 'Shopping list items' })
    fireEvent.click(within(list).getByRole('option'))

    // The failed toggle rolls back to to_buy and surfaces the banner — no dialog.
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to update/i)
    await waitFor(() => expect(useShoppingListStore.getState().items[0].status).toBe('to_buy'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('records a total Line Price at check-off and shows it on the row', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemDetails).mockImplementation(async (_id, details) =>
      makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', linePrice: details.linePrice ?? null }),
    )

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })

    const dialog = await openDetailsDialog(user)
    await user.type(within(dialog).getByRole('spinbutton'), '4.50')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(apiUpdateShoppingListItemDetails).toHaveBeenCalledWith(1, { linePrice: 4.5, expirationDate: null })
    await waitFor(() => expect(useShoppingListStore.getState().items[0].linePrice).toBe(4.5))
    expect(await screen.findByText('$4.50')).toBeInTheDocument()
  })

  it('records a per-unit price multiplied by the quantity, persisting only the total', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemDetails).mockImplementation(async (_id, details) =>
      makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', linePrice: details.linePrice ?? null }),
    )

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })

    const dialog = await openDetailsDialog(user)
    // Switch to per-unit entry, then a $3 unit price on a 2-unit line persists a $6 total.
    await user.click(within(dialog).getByRole('button', { name: /per unit/i }))
    await user.type(within(dialog).getByRole('spinbutton'), '3')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(apiUpdateShoppingListItemDetails).toHaveBeenCalledWith(1, { linePrice: 6, expirationDate: null })
    await waitFor(() => expect(useShoppingListStore.getState().items[0].linePrice).toBe(6))
  })

  it('records an expiration date picked from the calendar and shows it on the row', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemDetails).mockImplementation(async (_id, details) =>
      makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', expirationDate: details.expirationDate ?? null }),
    )

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz' })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })

    const dialog = await openDetailsDialog(user)
    // Open the Calendar panel, step to next month (so the day is always in the future regardless of the
    // runner's clock), and pick the 15th.
    await user.click(within(dialog).getByRole('combobox', { name: /expiration date/i }))
    await user.click(document.querySelector('.p-datepicker-next') as HTMLElement)
    const panel = document.querySelector('.p-datepicker') as HTMLElement
    await user.click(within(panel).getByText('15'))
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    // The picked day persists at UTC midnight, timezone-stable.
    const now = new Date()
    const expected = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 15))
    expect(apiUpdateShoppingListItemDetails).toHaveBeenCalledWith(1, { linePrice: null, expirationDate: expected })
    await waitFor(() => expect(useShoppingListStore.getState().items[0].expirationDate).toEqual(expected))
    expect(await screen.findByText(`Exp ${formatUtcDateForInput(expected)}`)).toBeInTheDocument()
  })

  it('splits the line into date-grouped lines when items get different expiration dates', async () => {
    const user = userEvent.setup()
    const seededDate = new Date('2026-08-01T00:00:00.000Z')
    vi.mocked(apiSplitShoppingListItem).mockResolvedValue([
      makeItem({ id: 1, food: mockFoods[0], amount: 1, unit: 'oz', expirationDate: seededDate }),
      makeItem({ id: 2, food: mockFoods[0], amount: 1, unit: 'oz', expirationDate: null }),
    ])

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', expirationDate: seededDate })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })

    const dialog = await openDetailsDialog(user)
    // Switch to per-item dates: the sole portion is seeded with the stored date + full amount.
    fireEvent.click(within(dialog).getByRole('button', { name: /per item/i }))
    // Add a second (undated) group and give each portion one unit — two distinct groups → a split.
    await user.click(within(dialog).getByRole('button', { name: /add date/i }))
    const qty1 = within(dialog).getByRole('spinbutton', { name: /item 1 quantity/i })
    const qty2 = within(dialog).getByRole('spinbutton', { name: /item 2 quantity/i })
    await user.clear(qty1)
    await user.type(qty1, '1')
    await user.clear(qty2)
    await user.type(qty2, '1')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(apiSplitShoppingListItem).toHaveBeenCalledWith(1, {
      portions: [
        { amount: 1, expirationDate: seededDate },
        { amount: 1, expirationDate: null },
      ],
      linePrice: null,
    })
    // The one line is replaced by the two the server returns.
    await waitFor(() => expect(useShoppingListStore.getState().items).toHaveLength(2))
  })

  it('offers the per-item toggle only when buying more than one', async () => {
    const user = userEvent.setup()

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 1, unit: 'oz' })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })

    const dialog = await openDetailsDialog(user)
    // A single-quantity line has nothing to split, so only the whole-line picker shows.
    expect(within(dialog).queryByRole('button', { name: /per item/i })).not.toBeInTheDocument()
  })

  it('seeds the dialog from an existing price and shows an error when the save fails', async () => {
    const user = userEvent.setup()
    vi.mocked(apiUpdateShoppingListItemDetails).mockRejectedValue(new Error('network'))

    render(
      <ShoppingListView
        initialFoods={mockFoods}
        initialItems={[makeItem({ id: 1, food: mockFoods[0], amount: 2, unit: 'oz', linePrice: 5 })]}
      />,
    )
    await screen.findByRole('listbox', { name: 'Shopping list items' })
    // The persisted price is already visible on the row.
    expect(screen.getByText('$5.00')).toBeInTheDocument()

    const dialog = await openDetailsDialog(user)
    // The dialog re-seeds from the stored total.
    expect(within(dialog).getByRole('spinbutton')).toHaveValue('$5.00')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/failed to save/i)
    // The failed save left the stored price untouched.
    expect(useShoppingListStore.getState().items[0].linePrice).toBe(5)
  })
})
