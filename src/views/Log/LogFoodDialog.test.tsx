import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogFoodDialog from './LogFoodDialog'
import type { Food } from '@/types/Food'
import { useFoodStore } from '@/stores/food'

const { apiCreateFoodLogEntry } = vi.hoisted(() => ({ apiCreateFoodLogEntry: vi.fn() }))
vi.mock('@/lib/api/foodLog', () => ({ apiCreateFoodLogEntry }))
vi.mock('@/lib/api/foods', () => ({ apiFetchFoods: vi.fn().mockResolvedValue([]) }))

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

describe('LogFoodDialog unit weight warning', () => {
  function open(food: Food) {
    render(
      <LogFoodDialog visible meal="Lunch" logDate="2026-11-12" seedFoods={[food]} onHide={() => {}} onLogged={() => {}} />,
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

  it('saves "1 1/2" as an amount of 1.5', async () => {
    const onLogged = vi.fn()
    render(
      <LogFoodDialog visible meal="Breakfast" logDate="2026-11-12" seedFoods={[bread]} onHide={() => {}} onLogged={onLogged} />,
    )
    fireEvent.click(await screen.findByText('Bread'))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1 1/2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log to Breakfast' }))
    await waitFor(() => expect(apiCreateFoodLogEntry).toHaveBeenCalled())
    expect(apiCreateFoodLogEntry).toHaveBeenCalledWith({ foodId: 7, amount: 1.5, unit: 'slice', logDate: '2026-11-12' })
  })

  it('shows no sample foods when opened with an empty search and a fresh store', () => {
    render(
      <LogFoodDialog visible meal="Lunch" logDate="2026-11-12" seedFoods={useFoodStore.getState().foods} onHide={() => {}} onLogged={() => {}} />,
    )
    for (const name of ['Ham', 'Cheese', 'Bread', 'Spaghetti', 'Ground Beef']) {
      expect(screen.queryByText(name)).toBeNull()
    }
  })
})
