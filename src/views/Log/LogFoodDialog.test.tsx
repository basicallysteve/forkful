import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogFoodDialog from './LogFoodDialog'
import type { Food } from '@/types/Food'
import { useFoodStore } from '@/stores/food'
import { UnauthorizedError } from '@/lib/api/errors'

const { apiCreateFoodLogEntry, apiFetchFoods } = vi.hoisted(() => ({ apiCreateFoodLogEntry: vi.fn(), apiFetchFoods: vi.fn() }))
vi.mock('@/lib/api/foodLog', () => ({ apiCreateFoodLogEntry }))
vi.mock('@/lib/api/foods', () => ({ apiFetchFoods }))

const bread: Food = {
  id: 7,
  name: 'Bread',
  calories: 100,
  protein: 3,
  carbs: 20,
  fat: 1,
  fiber: 1,
  servingSize: 1,
  servingUnit: 'slice',
  measurements: [{ unit: 'slice' }],
}

const SLOTS = ['Breakfast', 'Lunch', 'Dinner']

const WARNING = 'We cannot calculate calories for this unit.'

// A cup measurement with no weight or density: logging in it would freeze zero macros.
const flour: Food = {
  id: 8,
  name: 'Flour',
  calories: 364,
  protein: 10,
  carbs: 76,
  fat: 1,
  fiber: 3,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'cup' }],
}

async function pickUnit(label: string) {
  const dropdown = document.body.querySelector('.p-dropdown') as HTMLElement
  fireEvent.click(dropdown)
  const items = await screen.findAllByText(label)
  fireEvent.click(items[items.length - 1])
}

beforeEach(() => {
  apiFetchFoods.mockReset()
  apiFetchFoods.mockResolvedValue([])
})

describe('LogFoodDialog unit weight warning', () => {
  function open(food: Food) {
    render(
      <LogFoodDialog visible mealSlot="Lunch" mealSlots={SLOTS} seedFoods={[food]} onHide={() => {}} onLogged={() => {}} />,
    )
  }

  it('shows no warning for a unit that has a weight', async () => {
    open(flour)
    fireEvent.click(await screen.findByText('Flour'))
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('warns, as a status, when the chosen unit has no weight, then clears on a convertible unit', async () => {
    open(flour)
    fireEvent.click(await screen.findByText('Flour'))
    await pickUnit('cups')
    const warning = await screen.findByText(WARNING)
    expect(warning.getAttribute('role')).toBe('status')

    await pickUnit('grams')
    await waitFor(() => expect(screen.queryByText(WARNING)).toBeNull())
  })

  it('still lets the user log with the warning showing', async () => {
    apiCreateFoodLogEntry.mockResolvedValue({ id: 2 })
    open(flour)
    fireEvent.click(await screen.findByText('Flour'))
    await pickUnit('cups')
    await screen.findByText(WARNING)
    fireEvent.click(screen.getByRole('button', { name: 'Log to Lunch' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
  })
})

describe('LogFoodDialog', () => {
  beforeEach(() => {
    apiCreateFoodLogEntry.mockReset()
    apiCreateFoodLogEntry.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves "1 1/2" as an amount of 1.5', async () => {
    const onLogged = vi.fn()
    render(
      <LogFoodDialog visible mealSlot="Breakfast" mealSlots={SLOTS} seedFoods={[bread]} onHide={() => {}} onLogged={onLogged} />,
    )
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0))
    fireEvent.click(await screen.findByText('Bread'))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1 1/2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log to Breakfast' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry).toHaveBeenCalledWith({ foodId: 7, amount: 1.5, unit: 'slice', logDate: '2026-11-12', mealSlot: 'Breakfast' })
  })

  it('shows no sample foods when opened with an empty search and a fresh store', () => {
    render(
      <LogFoodDialog visible mealSlot="Lunch" mealSlots={SLOTS} seedFoods={useFoodStore.getState().foods} onHide={() => {}} onLogged={() => {}} />,
    )
    for (const name of ['Ham', 'Cheese', 'Bread', 'Spaghetti', 'Ground Beef']) {
      expect(screen.queryByText(name)).toBeNull()
    }
  })
})

function manyFoods(n: number): Food[] {
  return Array.from({ length: n }, (_, i) => ({ ...bread, id: 100 + i, name: `Food ${String(i + 1).padStart(2, '0')}` }))
}

function openWith(foods: Food[], extra: Partial<{ onHide: () => void }> = {}) {
  return render(
    <LogFoodDialog visible mealSlot="Lunch" mealSlots={SLOTS} seedFoods={foods} onHide={extra.onHide ?? (() => {})} onLogged={() => {}} />,
  )
}

describe('LogFoodDialog results list', () => {
  it('shows the top 20 of 50 results with a refine hint and no paginator', async () => {
    openWith(manyFoods(50))
    await screen.findByText('Food 01')
    expect(screen.getByText('Food 20')).toBeTruthy()
    expect(screen.queryByText('Food 21')).toBeNull()
    expect(screen.getByText(/Refine your search/i)).toBeTruthy()
    expect(document.body.querySelector('.p-paginator')).toBeNull()
  })

  it('shows no refine hint when everything fits', async () => {
    openWith(manyFoods(20))
    await screen.findByText('Food 20')
    expect(screen.queryByText(/Refine your search/i)).toBeNull()
  })

  it('points to the Foods page when nothing matches', async () => {
    openWith([])
    expect(await screen.findByText(/No foods found/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Foods page/i })
    expect(link.getAttribute('href')).toBe('/foods')
  })

  it('shows an error with a retry, not "No foods found", when the search fails', async () => {
    apiFetchFoods.mockRejectedValueOnce(new Error('boom'))
    openWith([])
    fireEvent.change(screen.getByLabelText('Search foods'), { target: { value: 'oat' } })
    const alert = await screen.findByRole('alert', {}, { timeout: 2000 })
    expect(alert.textContent).toMatch(/could not search/i)
    expect(screen.queryByText(/No foods found/i)).toBeNull()

    apiFetchFoods.mockResolvedValueOnce([{ ...bread, id: 55, name: 'Oats' }])
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Oats')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('LogFoodDialog focus and keys', () => {
  it('focuses the search input when it opens', async () => {
    openWith([bread])
    await waitFor(() => expect(screen.getByLabelText('Search foods')).toHaveFocus())
  })

  it('does not close when a space is typed in the search', async () => {
    const onHide = vi.fn()
    openWith([bread], { onHide })
    const input = screen.getByLabelText('Search foods')
    fireEvent.keyDown(input, { key: ' ', code: 'Space' })
    fireEvent.keyUp(input, { key: ' ', code: 'Space' })
    fireEvent.change(input, { target: { value: 'whole wheat' } })
    expect(onHide).not.toHaveBeenCalled()
    expect((input as HTMLInputElement).value).toBe('whole wheat')
  })

  it('moves focus to Amount after a food is picked', async () => {
    openWith([bread])
    fireEvent.click(await screen.findByText('Bread'))
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveFocus())
  })

  it('closes on Escape at the search step', async () => {
    const onHide = vi.fn()
    openWith([bread], { onHide })
    await screen.findByText('Bread')
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(onHide).toHaveBeenCalled())
  })

  it('closes on Escape at the amount step', async () => {
    const onHide = vi.fn()
    openWith([bread], { onHide })
    fireEvent.click(await screen.findByText('Bread'))
    await screen.findByLabelText('Amount')
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(onHide).toHaveBeenCalled())
  })
})

describe('LogFoodDialog log day', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('works out the day at each write, not when the dialog opened (23:59 to 00:01)', async () => {
    apiCreateFoodLogEntry.mockReset()
    apiCreateFoodLogEntry.mockResolvedValue({ id: 3 })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 0))
    openWith([bread])
    fireEvent.click(await screen.findByText('Bread'))
    vi.setSystemTime(new Date(2026, 10, 13, 0, 1, 0))
    fireEvent.click(screen.getByRole('button', { name: 'Log to Lunch' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry.mock.calls.at(-1)?.[0].logDate).toBe('2026-11-13')
  })

  it('asks the user to sign in when the write is rejected with a 401', async () => {
    apiCreateFoodLogEntry.mockReset()
    apiCreateFoodLogEntry.mockRejectedValue(new UnauthorizedError())
    openWith([bread])
    fireEvent.click(await screen.findByText('Bread'))
    fireEvent.click(screen.getByRole('button', { name: 'Log to Lunch' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/sign in/i)
  })
})

describe('LogFoodDialog meal slot', () => {
  beforeEach(() => {
    apiCreateFoodLogEntry.mockReset()
    apiCreateFoodLogEntry.mockResolvedValue({ id: 1 })
  })

  function slotDropdown() {
    // The unit dropdown comes first, the optional Meal Slot picker second.
    return document.body.querySelectorAll('.p-dropdown')[1] as HTMLElement
  }

  it('preselects the slot the dialog was launched from and records it', async () => {
    render(
      <LogFoodDialog visible mealSlot="Brunch" mealSlots={['Breakfast', 'Brunch']} seedFoods={[bread]} onHide={() => {}} onLogged={() => {}} />,
    )
    fireEvent.click(await screen.findByText('Bread'))
    fireEvent.click(screen.getByRole('button', { name: 'Log to Brunch' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry.mock.calls[0][0].mealSlot).toBe('Brunch')
  })

  it('lets the user pick a different slot, and says so on the button', async () => {
    render(
      <LogFoodDialog visible mealSlot="Breakfast" mealSlots={['Breakfast', 'Brunch']} seedFoods={[bread]} onHide={() => {}} onLogged={() => {}} />,
    )
    fireEvent.click(await screen.findByText('Bread'))
    fireEvent.click(slotDropdown())
    const items = await screen.findAllByText('Brunch')
    fireEvent.click(items[items.length - 1])
    fireEvent.click(await screen.findByRole('button', { name: 'Log to Brunch' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry.mock.calls[0][0].mealSlot).toBe('Brunch')
  })

  it('logs with no slot, and no "Log to" label, when opened without one', async () => {
    render(
      <LogFoodDialog visible mealSlot={null} mealSlots={['Breakfast']} seedFoods={[bread]} onHide={() => {}} onLogged={() => {}} />,
    )
    fireEvent.click(await screen.findByText('Bread'))
    expect(screen.queryByText(/Log to/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Log food' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry.mock.calls[0][0].mealSlot).toBeNull()
  })
})

describe('LogFoodDialog header follows the picked slot', () => {
  it('updates the header when the picker changes, so it matches the button', async () => {
    apiCreateFoodLogEntry.mockReset()
    render(
      <LogFoodDialog visible mealSlot="Snack" mealSlots={['Breakfast', 'Snack']} seedFoods={[bread]} onHide={() => {}} onLogged={() => {}} />,
    )
    fireEvent.click(await screen.findByText('Bread'))
    expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Log to Snack')
    fireEvent.click(document.body.querySelectorAll('.p-dropdown')[1] as HTMLElement)
    const items = await screen.findAllByText('Breakfast')
    fireEvent.click(items[items.length - 1])
    await waitFor(() => expect(document.querySelector('.p-dialog-title')?.textContent).toBe('Log to Breakfast'))
  })
})
