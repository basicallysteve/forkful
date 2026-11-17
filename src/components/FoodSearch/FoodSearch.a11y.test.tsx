import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FoodSearch from './FoodSearch'
import type { Food } from '@/types/Food'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'u' } }, status: 'authenticated' }),
}))
const mockFetchFoods = vi.fn()
vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: (...a: unknown[]) => mockFetchFoods(...a),
  apiCreateFood: vi.fn(),
}))
vi.mock('@/lib/api/openFoodFacts', () => ({
  apiSearchOpenFoodFacts: vi.fn().mockResolvedValue([]),
  mapOFFProductToFood: vi.fn(),
}))

function food(id: number, name: string): Food {
  return {
    id, name, calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0,
    servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }],
  }
}

describe('FoodSearch accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetchFoods.mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  function setup() {
    render(
      <FoodSearch
        value=""
        localFoods={[food(1, 'Apple'), food(2, 'Apple pie')]}
        onChange={vi.fn()}
        inputAriaLabel="Ingredient food"
      />,
    )
    return screen.getByRole('combobox', { name: 'Ingredient food' })
  }

  it('names the input from inputAriaLabel', () => {
    expect(setup()).toBeInTheDocument()
  })

  it('announces Searching… in the single live region, then the result count', async () => {
    const input = setup()
    fireEvent.change(input, { target: { value: 'apple' } })
    const status = screen.getByRole('status')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Searching…')

    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(status).not.toHaveTextContent('Searching…')
    // the add row is not counted as a match
    expect(status).toHaveTextContent('2 results')
  })

  it('announces No matches when only the add row is left', async () => {
    const input = setup()
    fireEvent.change(input, { target: { value: 'zzqxj' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.getByRole('status')).toHaveTextContent('No matches')
  })

  it('keeps the live region out of the listbox', () => {
    const input = setup()
    fireEvent.change(input, { target: { value: 'zzqxj' } })
    expect(screen.getByRole('listbox').querySelector('[role="status"]')).toBeNull()
  })

  it('follows the highlighted option with aria-activedescendant', async () => {
    const input = setup()
    // a real user focuses the field before typing; the id sync only runs while it has focus
    act(() => input.focus())
    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await act(async () => {})
    const id = input.getAttribute('aria-activedescendant')
    expect(id).toBeTruthy()
    const el = document.getElementById(id!)
    expect(el).toHaveAttribute('role', 'option')
    expect(el).toHaveTextContent('Apple')
  })
})
