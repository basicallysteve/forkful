import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Store from './Store'
import { useFoodStore, resetFoodStore } from '@/stores/food'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'loading', update: vi.fn() }),
  signOut: vi.fn(),
  signIn: vi.fn(),
}))

describe('Store Page - unknown food while the session is still loading (#237)', () => {
  beforeEach(() => {
    resetFoodStore()
    useFoodStore.setState({ foods: [{ id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }] }] })
  })

  it('does not offer the add row until the user is known to be signed in', async () => {
    const user = userEvent.setup()
    render(<Store />)
    await user.click(screen.getByRole('button', { name: /ingredients tab/i }))
    await user.type(screen.getAllByPlaceholderText('Select food')[0], 'Dragon fruit')
    expect(screen.queryByRole('option', { name: /as a new food/i })).not.toBeInTheDocument()
  })
})
