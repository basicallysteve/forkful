import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuickAddFoodModal from './QuickAddFoodModal'
import { UnauthorizedError, HttpError, SIGN_IN_REQUIRED_MESSAGE, describeSaveFailure } from '@/lib/api/errors'

const mockCreateFood = vi.fn()
const mockFetchFoods = vi.fn()
vi.mock('@/lib/api/foods', () => ({
  apiCreateFood: (...a: unknown[]) => mockCreateFood(...a),
  apiFetchFoods: (...a: unknown[]) => mockFetchFoods(...a),
}))

function setup(initialName = 'Dragon fruit') {
  const onCreated = vi.fn()
  const onExisting = vi.fn()
  const onHide = vi.fn()
  render(<QuickAddFoodModal initialName={initialName} onCreated={onCreated} onExisting={onExisting} onHide={onHide} />)
  return { onCreated, onExisting, onHide }
}

describe('QuickAddFoodModal', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetchFoods.mockResolvedValue([]) })

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

  it('offers a sign-in link on 401 that opens in a new tab so typed values are kept', async () => {
    mockCreateFood.mockRejectedValue(new UnauthorizedError())
    setup()
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login?callbackUrl=%2F')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByLabelText('Name')).toHaveValue('Dragon fruit')
    expect(screen.getByLabelText('Calories')).toHaveValue(60)
  })

  function submit() {
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
  }

  it('shows an error, stays open and keeps the typed values when the create fails', async () => {
    mockCreateFood.mockRejectedValue(new HttpError('Failed to create food', 500))
    const { onCreated, onHide } = setup()
    fireEvent.change(screen.getByLabelText('Protein (g)'), { target: { value: '2.5' } })
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(describeSaveFailure(new HttpError('x', 500)))
    expect(onCreated).not.toHaveBeenCalled()
    expect(onHide).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toHaveValue('Dragon fruit')
    expect(screen.getByLabelText('Calories')).toHaveValue(60)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(2.5)
    expect(screen.getByRole('button', { name: 'Add food' })).toBeEnabled()
  })

  it('shows an error when the request itself fails (offline)', async () => {
    mockCreateFood.mockRejectedValue(new TypeError('Failed to fetch'))
    setup()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  })

  it('clears the error when the user retries and it succeeds', async () => {
    mockCreateFood.mockRejectedValueOnce(new HttpError('Failed to create food', 500))
    mockCreateFood.mockResolvedValueOnce({ id: 9, name: 'Dragon fruit' })
    const { onCreated } = setup()
    submit()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Add food' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('selects the existing food instead of creating when the name already exists, ignoring case and spacing', async () => {
    const existing = { id: 3, name: 'dragon FRUIT' }
    mockFetchFoods.mockResolvedValue([{ id: 4, name: 'Dragon fruit juice' }, existing])
    const { onCreated, onExisting } = setup('  Dragon Fruit ')
    submit()
    await waitFor(() => expect(onExisting).toHaveBeenCalledWith(existing))
    expect(mockCreateFood).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('creates when only a partial name match exists', async () => {
    mockFetchFoods.mockResolvedValue([{ id: 4, name: 'Dragon fruit juice' }])
    mockCreateFood.mockResolvedValue({ id: 7, name: 'Dragon fruit' })
    const { onCreated, onExisting } = setup()
    submit()
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onExisting).not.toHaveBeenCalled()
  })

  it('still creates when the duplicate lookup fails', async () => {
    mockFetchFoods.mockRejectedValue(new Error('boom'))
    mockCreateFood.mockResolvedValue({ id: 7, name: 'Dragon fruit' })
    const { onCreated } = setup()
    submit()
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })
})
