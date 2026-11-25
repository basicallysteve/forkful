import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Store from './Store'
import { useFoodStore, resetFoodStore } from '@/stores/food'
import { resetRecipeStore } from '@/stores/recipes'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/recipes', () => ({ apiCreateRecipe: vi.fn() }))

const mockApiFetchFoods = vi.fn()
vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: (...a: unknown[]) => mockApiFetchFoods(...a),
  apiCreateFood: vi.fn(),
}))

const ham: Food = { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'g' }] }

async function openIngredientsTab() {
  const user = userEvent.setup()
  render(<Store />)
  await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
  return user
}

describe('Recipe editor loads the foods it needs on its own (#358)', () => {
  beforeEach(() => {
    mockApiFetchFoods.mockReset()
    resetFoodStore()
    resetRecipeStore()
  })

  it('fetches foods on a hard load (store not hydrated) and shows a loading state, not "No foods available"', async () => {
    mockApiFetchFoods.mockReturnValue(new Promise(() => {}))
    await openIngredientsTab()
    expect(mockApiFetchFoods).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status', { name: 'Loading foods' })).toBeInTheDocument()
    expect(screen.queryByText(/No foods available/)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Select food')).not.toBeInTheDocument()
  })

  it('shows the usable add-ingredient row, with the loaded foods in the store, once they arrive', async () => {
    mockApiFetchFoods.mockResolvedValue([ham])
    await openIngredientsTab()
    expect(await screen.findByPlaceholderText('Select food')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading foods' })).not.toBeInTheDocument()
    expect(screen.queryByText(/No foods available/)).not.toBeInTheDocument()
    expect(useFoodStore.getState().foods).toEqual([ham])
  })

  it('says "No foods available" only when the library really is empty', async () => {
    mockApiFetchFoods.mockResolvedValue([])
    await openIngredientsTab()
    expect(await screen.findByText(/No foods available/)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading foods' })).not.toBeInTheDocument()
  })

  it('shows an error with Retry when the fetch fails, and Retry recovers', async () => {
    mockApiFetchFoods.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([ham])
    const user = await openIngredientsTab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load foods.')
    expect(screen.queryByText(/No foods available/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByPlaceholderText('Select food')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(mockApiFetchFoods).toHaveBeenCalledTimes(2)
  })

  it('does not refetch or flash a loading state when the store is already hydrated', async () => {
    useFoodStore.setState({ foods: [ham] })
    await openIngredientsTab()
    expect(screen.getByPlaceholderText('Select food')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading foods' })).not.toBeInTheDocument()
    expect(mockApiFetchFoods).not.toHaveBeenCalled()
  })
})
