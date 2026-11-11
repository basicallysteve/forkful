import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarcodeCreationModal from './BarcodeCreationModal'
import type { Product } from '@/types/Product'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/products', () => ({
  apiCreateProduct: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/stores/food', () => ({
  useFoodStore: vi.fn((selector: (s: { foods: Food[]; setFoods: () => void }) => unknown) =>
    selector({ foods: [], setFoods: vi.fn() })
  ),
}))

// FoodSearch is complex — stub it so tests can trigger food selection directly
vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: ({ onChange }: { onChange: (f: Food) => void }) => (
    <button
      onClick={() => onChange({ id: 99, name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 3, servingSize: 40, servingUnit: 'g', measurements: [{ unit: 'g' }] })}
    >
      Select Oatmeal
    </button>
  ),
}))

import { apiCreateProduct } from '@/lib/api/products'

const BARCODE = '012345678905'

const createdProduct: Product = {
  id: 7,
  name: 'Quaker Oats',
  slug: 'quaker-oats',
  barcode: BARCODE,
  parentFoodId: 99,
  calories: 150,
  protein: 5,
  carbs: 27,
  fat: 3,
  fiber: 3,
  servingSize: 40,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }],
  source: 'manual',
}

function renderModal(overrides: Partial<React.ComponentProps<typeof BarcodeCreationModal>> = {}) {
  const onCreated = vi.fn()
  const onHide = vi.fn()
  render(
    <BarcodeCreationModal
      barcode={BARCODE}
      onCreated={onCreated}
      onHide={onHide}
      {...overrides}
    />
  )
  return { onCreated, onHide }
}

describe('BarcodeCreationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiCreateProduct).mockResolvedValue(createdProduct)
  })

  it('renders the modal header', () => {
    renderModal()
    expect(screen.getByText('Add new product')).toBeInTheDocument()
  })

  it('displays the scanned barcode', () => {
    renderModal()
    expect(screen.getByText(BARCODE)).toBeInTheDocument()
  })

  it('disables Add product when name is empty', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /add product/i })).toBeDisabled()
  })

  it('disables Add product when food is not selected', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    expect(screen.getByRole('button', { name: /add product/i })).toBeDisabled()
  })

  it('enables Add product when name and food are both provided', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    expect(screen.getByRole('button', { name: /add product/i })).toBeEnabled()
  })

  it('calls apiCreateProduct with name, barcode, and parentFoodId on save', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /add product/i }))

    await waitFor(() =>
      expect(apiCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Quaker Oats',
          barcode: BARCODE,
          parentFoodId: 99,
        })
      )
    )
  })

  it('calls onCreated with the new product after successful save', async () => {
    const user = userEvent.setup()
    const { onCreated } = renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /add product/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdProduct))
  })

  it('shows a save error and does not call onCreated when apiCreateProduct fails', async () => {
    vi.mocked(apiCreateProduct).mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    const { onCreated } = renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /add product/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to save product/i)).toBeInTheDocument()
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('shows Saving… while the API call is in-flight', async () => {
    vi.mocked(apiCreateProduct).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /add product/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
  })

  it('saves with default servingUnit "g" when serving unit is left blank', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText(/product name/i), 'Quaker Oats')
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /add product/i }))

    await waitFor(() =>
      expect(apiCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({ servingUnit: 'g', measurements: [{ unit: 'g' }] })
      )
    )
  })

  it('calls onHide when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onHide } = renderModal()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onHide).toHaveBeenCalled()
  })
})
