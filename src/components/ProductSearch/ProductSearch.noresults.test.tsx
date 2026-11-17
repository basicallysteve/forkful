import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductSearch from './ProductSearch'

vi.mock('@/lib/api/products', () => ({
  apiFetchProducts: vi.fn(),
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
vi.mock('@/components/BarcodeScanner/BarcodeScanner', () => ({
  default: () => <div data-testid="scanner" />,
}))

import { apiFetchProducts } from '@/lib/api/products'

const MESSAGE = 'No products found. Try scanning a barcode.'

const oats = {
  id: 1,
  name: 'Abc Oats',
  slug: 'abc-oats',
  calories: 1,
  protein: 1,
  carbs: 1,
  fat: 1,
  fiber: 1,
  servingSize: 1,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }],
}

describe('ProductSearch no-results message', () => {
  beforeEach(() => {
    vi.mocked(apiFetchProducts).mockReset()
    vi.mocked(apiFetchProducts).mockResolvedValue([])
  })

  it('has an always-present polite live region', () => {
    render(<ProductSearch value="" onChange={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
  })

  it('shows the message after the debounce completes with no matches', async () => {
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    await user.type(screen.getByRole('combobox'), 'zzzz')
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
  })

  it('hides the message again when the user keeps typing', async () => {
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'zz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    await user.type(input, 'z')
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
  })

  it('shows the message when the search fails, and recovers on the next query', async () => {
    vi.mocked(apiFetchProducts).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'ab')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    vi.mocked(apiFetchProducts).mockResolvedValue([oats])
    await user.type(input, 'c')
    await waitFor(() => expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE))
  })

  it('does not show the message when there are results', async () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    await user.type(screen.getByRole('combobox'), 'abc')
    await screen.findByText('Abc Oats')
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
  })

  it('offers a button that switches to the barcode tab', async () => {
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    await user.type(screen.getByRole('combobox'), 'zzzz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    await user.click(screen.getByRole('button', { name: /scan a barcode/i }))
    expect(screen.getByTestId('scanner')).toBeInTheDocument()
  })

  it('offers no add-by-name action', async () => {
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} />)
    await user.type(screen.getByRole('combobox'), 'zzzz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    expect(screen.queryByText(/add .* as a new/i)).not.toBeInTheDocument()
  })
})
