import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuickAddFoodModal from './QuickAddFoodModal'
import { UnauthorizedError, SIGN_IN_REQUIRED_MESSAGE } from '@/lib/api/errors'

const mockCreateFood = vi.fn()
vi.mock('@/lib/api/foods', () => ({
  apiCreateFood: (...a: unknown[]) => mockCreateFood(...a),
}))

function setup(initialName = 'Dragon fruit') {
  const onCreated = vi.fn()
  const onHide = vi.fn()
  render(<QuickAddFoodModal initialName={initialName} onCreated={onCreated} onHide={onHide} />)
  return { onCreated, onHide }
}

describe('QuickAddFoodModal', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows the header and prefills the name', () => {
    setup()
    expect(screen.getByText('Add a new food')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Dragon fruit')
  })

  it('moves focus to the Name input on open', async () => {
    setup()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
  })

  it('requires name and calories, with macros defaulting to 0', () => {
    setup()
    expect(screen.getByLabelText('Name')).toBeRequired()
    expect(screen.getByLabelText('Calories')).toBeRequired()
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(0)
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(0)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(0)
  })

  it('creates the food per 100 g and reports it', async () => {
    const created = { id: 7, name: 'Dragon fruit' }
    mockCreateFood.mockResolvedValue(created)
    const { onCreated } = setup()
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Protein (g)'), { target: { value: '1.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created))
    expect(mockCreateFood).toHaveBeenCalledWith({
      name: 'Dragon fruit', calories: 60, protein: 1.2, carbs: 0, fat: 0, fiber: 0,
      servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }],
    })
  })

  it('closes with Cancel without creating', () => {
    const { onHide } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onHide).toHaveBeenCalled()
    expect(mockCreateFood).not.toHaveBeenCalled()
  })

  it('closes with Escape', () => {
    const { onHide } = setup()
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape', code: 'Escape' })
    expect(onHide).toHaveBeenCalled()
  })

  it('shows the sign-in message on an unauthorized error and stays open', async () => {
    mockCreateFood.mockRejectedValue(new UnauthorizedError())
    const { onCreated } = setup()
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_REQUIRED_MESSAGE)
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add food' })).toBeEnabled()
  })
})
