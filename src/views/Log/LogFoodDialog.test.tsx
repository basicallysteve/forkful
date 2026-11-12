import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogFoodDialog from './LogFoodDialog'
import type { Food } from '@/types/Food'

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
})
