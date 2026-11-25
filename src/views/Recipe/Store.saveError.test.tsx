import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Store from './Store'
import { apiCreateRecipe } from '@/lib/api/recipes'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { useRecipeStore, resetRecipeStore } from '@/stores/recipes'
import { useFoodStore, resetFoodStore } from '@/stores/food'

vi.mock('@/lib/api/recipes', () => ({
  apiCreateRecipe: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn(async () => []),
  apiCreateFood: vi.fn(),
}))

const TITLE = 'Could not save recipe'

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('e.g. Smoky chipotle chili'), 'Chipotle Chili')
  await user.click(screen.getByRole('radio', { name: /dinner/i }))
  await user.type(screen.getByPlaceholderText('Describe flavors, prep time, or serving ideas.'), 'Smoky and slow')
}

const failures: Array<[string, () => Error, string]> = [
  ['400 unknown food', () => new ApiError({ status: 400, kind: 'invalid', message: 'One of the ingredients no longer exists. Remove it and try again.' }), 'One of the ingredients no longer exists. Remove it and try again.'],
  ['network', () => new ApiError({ status: 0, kind: 'network', message: 'Failed to fetch' }), 'Check your connection and try again.'],
  ['401', () => new UnauthorizedError(), 'Your session expired. Sign in again to save this recipe.'],
  ['403', () => new ForbiddenError(), "You don't have permission to save this recipe."],
  ['5xx', () => new ApiError({ status: 500, kind: 'server', message: 'boom internal detail' }), 'Something went wrong on our side. Try again in a moment.'],
]

describe('Store Page - save error toast (#288)', () => {
  beforeEach(() => {
    resetFoodStore()
    resetRecipeStore()
    vi.mocked(apiCreateRecipe).mockReset()
  })

  describe.each(failures)('%s', (_label, makeError, message) => {
    it('shows the titled toast with a message that fits the failure', async () => {
      const user = userEvent.setup()
      vi.mocked(apiCreateRecipe).mockRejectedValueOnce(makeError())
      render(<Store />)
      await fillRequired(user)

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      expect(await screen.findByText(TITLE)).toBeInTheDocument()
      expect(screen.getByText(message)).toBeInTheDocument()
      expect(screen.queryByText('boom internal detail')).not.toBeInTheDocument()
    })

    it('keeps the input, adds nothing to the store and re-enables Save', async () => {
      const user = userEvent.setup()
      vi.mocked(apiCreateRecipe).mockRejectedValueOnce(makeError())
      render(<Store />)
      await fillRequired(user)

      await user.click(screen.getByRole('button', { name: /save recipe/i }))
      await screen.findByText(TITLE)

      expect(screen.getByPlaceholderText('e.g. Smoky chipotle chili')).toHaveValue('Chipotle Chili')
      expect(useRecipeStore.getState().recipes).toHaveLength(0)
      expect(screen.getByRole('button', { name: /save recipe/i })).toBeEnabled()
    })
  })

  it('shows the same toast when Publish fails', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateRecipe).mockRejectedValueOnce(new ForbiddenError())
    resetFoodStore()
    useFoodStore.setState({ foods: [{ id: 200, name: 'Test Ingredient', calories: 50, protein: 2, carbs: 5, fat: 1, fiber: 1, servingSize: 1, servingUnit: 'piece', measurements: [{ unit: 'piece' }, { unit: 'g' }] }] })
    render(<Store />)
    await fillRequired(user)
    // Publish needs at least one ingredient.
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
    await user.type(screen.getByPlaceholderText('Select food'), 'Test Ingredient')
    await user.click(await screen.findByRole('option', { name: /test ingredient/i }))
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))
    await user.click(screen.getByRole('button', { name: /details tab/i }))

    await user.click(screen.getByRole('button', { name: /publish/i }))

    expect(await screen.findByText(TITLE)).toBeInTheDocument()
    expect(screen.getByText("You don't have permission to save this recipe.")).toBeInTheDocument()
  })

  it('never shows a raw error message for an unrecognised error', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateRecipe).mockRejectedValueOnce(new Error('secret stack detail'))
    render(<Store />)
    await fillRequired(user)

    await user.click(screen.getByRole('button', { name: /save recipe/i }))

    expect(await screen.findByText(TITLE)).toBeInTheDocument()
    expect(screen.queryByText('secret stack detail')).not.toBeInTheDocument()
  })

  it('clears the previous save-error toast before showing a new one for the same save', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateRecipe)
      .mockRejectedValueOnce(new UnauthorizedError())
      .mockRejectedValueOnce(new ForbiddenError())
    render(<Store />)
    await fillRequired(user)

    await user.click(screen.getByRole('button', { name: /save recipe/i }))
    await screen.findByText('Your session expired. Sign in again to save this recipe.')

    await user.click(screen.getByRole('button', { name: /save recipe/i }))
    await screen.findByText("You don't have permission to save this recipe.")

    await waitFor(() => {
      expect(screen.queryByText('Your session expired. Sign in again to save this recipe.')).not.toBeInTheDocument()
    })
    expect(screen.getAllByText(TITLE)).toHaveLength(1)
  })

  it('does not show a toast when the save succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(apiCreateRecipe).mockImplementationOnce(async (r) => ({ ...r, id: 1, shortId: 'abc12345' }) as never)
    render(<Store />)
    await fillRequired(user)

    await user.click(screen.getByRole('button', { name: /save recipe/i }))

    await waitFor(() => expect(useRecipeStore.getState().recipes).toHaveLength(1))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })
})
