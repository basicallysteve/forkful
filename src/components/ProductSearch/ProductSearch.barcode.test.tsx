import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductSearch from './ProductSearch'
import type { Product } from '@/types/Product'

vi.mock('@/lib/api/products', () => ({
  apiFetchProducts: vi.fn().mockResolvedValue([]),
  apiFetchProductByBarcode: vi.fn(),
  apiCreateProduct: vi.fn(),
  apiLinkProductToFood: vi.fn(),
}))

vi.mock('@/lib/api/openFoodFacts', () => ({
  apiSearchOpenFoodFacts: vi.fn().mockResolvedValue([]),
  mapOFFProductToProduct: vi.fn(),
}))

vi.mock('@/lib/usda', () => ({
  mapUSDABrandedToProduct: vi.fn(),
  importUSDABrandedProduct: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/stores/food', () => ({
  useFoodStore: vi.fn((selector: (s: { foods: Product[]; setFoods: () => void }) => unknown) =>
    selector({ foods: [], setFoods: vi.fn() })
  ),
}))

import { apiFetchProductByBarcode } from '@/lib/api/products'

const mockProductWithFood: Product = {
  id: 1,
  name: 'Quaker Oats',
  slug: 'quaker-oats',
  barcode: '012345678905',
  parentFoodId: 10,
  calories: 150,
  protein: 5,
  carbs: 27,
  fat: 3,
  fiber: 2,
  servingSize: 40,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }],
}

const mockProductWithoutFood: Product = {
  ...mockProductWithFood,
  id: 2,
  name: 'Generic Brand Oats',
  slug: 'generic-brand-oats',
  parentFoodId: undefined,
}

function renderProductSearch(onChange = vi.fn()) {
  render(<ProductSearch value="" onChange={onChange} placeholder="Search or scan" />)
}

async function switchToBarcodeTab() {
  const user = userEvent.setup()
  const barcodeTab = screen.getByTitle('Scan barcode')
  await user.click(barcodeTab)
  return user
}

describe('ProductSearch — barcode flow branching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when barcode lookup returns a product with parentFoodId', () => {
    it('calls onChange immediately without opening any modal', async () => {
      vi.mocked(apiFetchProductByBarcode).mockResolvedValue(mockProductWithFood)
      const onChange = vi.fn()
      renderProductSearch(onChange)
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '012345678905')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(mockProductWithFood))
      expect(screen.queryByText('Add new product')).not.toBeInTheDocument()
      expect(screen.queryByText('Confirm food type')).not.toBeInTheDocument()
    })
  })

  describe('when barcode lookup returns a product without parentFoodId', () => {
    it('opens LinkFoodModal instead of calling onChange', async () => {
      vi.mocked(apiFetchProductByBarcode).mockResolvedValue(mockProductWithoutFood)
      const onChange = vi.fn()
      renderProductSearch(onChange)
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '012345678905')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() => expect(screen.getByText('Confirm food type')).toBeInTheDocument())
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows the product name in the LinkFoodModal', async () => {
      vi.mocked(apiFetchProductByBarcode).mockResolvedValue(mockProductWithoutFood)
      renderProductSearch()
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '012345678905')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() => expect(screen.getByText('Generic Brand Oats')).toBeInTheDocument())
    })
  })

  describe('when barcode lookup returns null', () => {
    it('opens BarcodeCreationModal instead of calling onChange', async () => {
      vi.mocked(apiFetchProductByBarcode).mockResolvedValue(null)
      const onChange = vi.fn()
      renderProductSearch(onChange)
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '000000000000')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() => expect(screen.getByText('Add new product')).toBeInTheDocument())
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows the scanned barcode in the BarcodeCreationModal', async () => {
      vi.mocked(apiFetchProductByBarcode).mockResolvedValue(null)
      renderProductSearch()
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '000000000000')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() => expect(screen.getByText('000000000000')).toBeInTheDocument())
    })
  })

  describe('when barcode lookup fails', () => {
    it('shows an error message', async () => {
      vi.mocked(apiFetchProductByBarcode).mockRejectedValue(new Error('Network error'))
      renderProductSearch()
      await switchToBarcodeTab()

      const input = screen.getByLabelText('Barcode number')
      const user = userEvent.setup()
      await user.type(input, '000000000000')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      await waitFor(() =>
        expect(screen.getByText(/barcode lookup failed/i)).toBeInTheDocument()
      )
    })
  })
})
