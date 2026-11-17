import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

const product = (id: number, name: string) => ({
  id, name, slug: name, calories: 1, protein: 1, carbs: 1, fat: 1, fiber: 1,
  servingSize: 1, servingUnit: 'g', measurements: [{ unit: 'g' }],
})

describe('ProductSearch accessibility', () => {
  beforeEach(() => {
    vi.mocked(apiFetchProducts).mockReset()
  })

  it('names the input', () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([])
    render(<ProductSearch value="" onChange={vi.fn()} inputAriaLabel="Product" />)
    expect(screen.getByRole('combobox', { name: 'Product' })).toBeInTheDocument()
  })

  it('announces Searching… then the result count in the one live region', async () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([product(1, 'Abc Oats'), product(2, 'Abc Rice')] as never)
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} inputAriaLabel="Product" />)
    await user.type(screen.getByRole('combobox'), 'abc')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 results'))
  })

  it('follows the highlighted option with aria-activedescendant', async () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([product(1, 'Abc Oats')] as never)
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} inputAriaLabel="Product" />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'abc')
    await screen.findByRole('option', { name: /Abc Oats/ })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'))
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Abc Oats')
  })

  it('goes quiet on Escape and on blur, and speaks again on the next search', async () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([product(1, 'Abc Oats'), product(2, 'Abc Rice')] as never)
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} inputAriaLabel="Product" />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'abc')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 results'))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await user.type(input, 'd')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 results'))
    await user.tab()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('goes quiet after selecting an option', async () => {
    const onChange = vi.fn()
    vi.mocked(apiFetchProducts).mockResolvedValue([product(1, 'Abc Oats')] as never)
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={onChange} inputAriaLabel="Product" />)
    await user.type(screen.getByRole('combobox'), 'abc')
    await user.click(await screen.findByRole('option', { name: /Abc Oats/ }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces only the no-results message, not the Scan a barcode button text', async () => {
    vi.mocked(apiFetchProducts).mockResolvedValue([])
    const user = userEvent.setup()
    render(<ProductSearch value="" onChange={vi.fn()} inputAriaLabel="Product" />)
    await user.type(screen.getByRole('combobox'), 'zzzz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No products found'))
    expect(screen.getByRole('status')).not.toHaveTextContent('Scan a barcode')
    expect(screen.getByRole('button', { name: 'Scan a barcode' })).toBeInTheDocument()
  })
})
