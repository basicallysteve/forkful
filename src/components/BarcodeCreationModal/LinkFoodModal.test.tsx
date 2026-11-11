import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkFoodModal from './LinkFoodModal'
import type { Product } from '@/types/Product'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/products', () => ({
  apiLinkProductToFood: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/stores/food', () => ({
  useFoodStore: vi.fn((selector: (s: { foods: Food[]; setFoods: () => void }) => unknown) =>
    selector({ foods: [], setFoods: vi.fn() })
  ),
}))

vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: ({ onChange }: { onChange: (f: Food) => void }) => (
    <button
      onClick={() => onChange({ id: 42, name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 3, servingSize: 40, servingUnit: 'g', measurements: [{ unit: 'g' }] })}
    >
      Select Oatmeal
    </button>
  ),
}))

import { apiLinkProductToFood } from '@/lib/api/products'

const productWithSlug: Product = {
  id: 2,
  name: 'Generic Brand Oats',
  slug: 'generic-brand-oats',
  barcode: '012345678905',
  calories: 150,
  protein: 5,
  carbs: 27,
  fat: 3,
  fiber: 2,
  servingSize: 40,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }],
}

const productWithoutSlug: Product = { ...productWithSlug, slug: undefined }

function renderModal(
  product: Product = productWithSlug,
  overrides: Partial<React.ComponentProps<typeof LinkFoodModal>> = {}
) {
  const onLinked = vi.fn()
  const onSkip = vi.fn()
  const onHide = vi.fn()
  render(
    <LinkFoodModal
      product={product}
      onLinked={onLinked}
      onSkip={onSkip}
      onHide={onHide}
      {...overrides}
    />
  )
  return { onLinked, onSkip, onHide }
}

describe('LinkFoodModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiLinkProductToFood).mockResolvedValue(undefined)
  })

  it('renders the modal header', () => {
    renderModal()
    expect(screen.getByText('Confirm food type')).toBeInTheDocument()
  })

  it('shows the product name in the description', () => {
    renderModal()
    expect(screen.getByText('Generic Brand Oats')).toBeInTheDocument()
  })

  it('disables Confirm when no food is selected', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('disables Confirm when product has no slug', async () => {
    const user = userEvent.setup()
    renderModal(productWithoutSlug)
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('enables Confirm when food is selected and slug is present', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled()
  })

  it('calls apiLinkProductToFood with the product slug and selected food id', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() =>
      expect(apiLinkProductToFood).toHaveBeenCalledWith('generic-brand-oats', 42)
    )
  })

  it('calls onLinked with the updated product (parentFoodId set) after linking', async () => {
    const user = userEvent.setup()
    const { onLinked } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() =>
      expect(onLinked).toHaveBeenCalledWith({ ...productWithSlug, parentFoodId: 42 })
    )
  })

  it('shows an error and does not call onLinked when apiLinkProductToFood fails', async () => {
    vi.mocked(apiLinkProductToFood).mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    const { onLinked } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to link food/i)).toBeInTheDocument()
    )
    expect(onLinked).not.toHaveBeenCalled()
  })

  it('shows Saving… on the button while the API call is in-flight', async () => {
    vi.mocked(apiLinkProductToFood).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: 'Select Oatmeal' }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
  })

  it('calls onSkip with the original product when Skip is clicked', async () => {
    const user = userEvent.setup()
    const { onSkip } = renderModal()
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalledWith(productWithSlug)
  })

  it('does not call apiLinkProductToFood when Skip is clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(apiLinkProductToFood).not.toHaveBeenCalled()
  })
})
