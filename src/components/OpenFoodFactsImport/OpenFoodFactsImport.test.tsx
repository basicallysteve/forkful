import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpenFoodFactsImport from './OpenFoodFactsImport'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import type { Food } from '@/types/Food'

vi.mock('@/lib/api/openFoodFacts', () => ({
  apiSearchOpenFoodFacts: vi.fn(),
  mapOFFProductToFood: vi.fn(),
}))

vi.mock('@/lib/api/foods', () => ({
  apiCreateFood: vi.fn(),
}))

import { apiSearchOpenFoodFacts, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import { apiCreateFood } from '@/lib/api/foods'

const mockProduct: OFFProduct = {
  code: '123',
  product_name: 'Greek Yogurt',
  nutriments: {
    'energy-kcal_100g': 59,
    'proteins_100g': 10,
    'carbohydrates_100g': 3.6,
    'fat_100g': 0.4,
    'fiber_100g': 0,
  },
  serving_size: '170g',
  serving_quantity: 170,
}

const mockMappedFood: Omit<Food, 'id'> = {
  name: 'Greek Yogurt',
  calories: 100,
  protein: 17,
  carbs: 6.1,
  fat: 0.7,
  fiber: 0,
  servingSize: 170,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }],
  source: 'open_food_facts',
}

const mockCreatedFood: Food = { id: 99, ...mockMappedFood }

function renderComponent(props: Partial<React.ComponentProps<typeof OpenFoodFactsImport>> = {}) {
  const onHide = vi.fn()
  const onImport = vi.fn()
  render(
    <OpenFoodFactsImport
      visible={true}
      onHide={onHide}
      onImport={onImport}
      {...props}
    />
  )
  return { onHide, onImport }
}

describe('OpenFoodFactsImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mapOFFProductToFood).mockReturnValue(mockMappedFood)
    vi.mocked(apiCreateFood).mockResolvedValue(mockCreatedFood)
    vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([])
  })

  describe('Dialog visibility', () => {
    it('renders the dialog when visible is true', () => {
      renderComponent()
      expect(screen.getByText('Import from OpenFoodFacts')).toBeInTheDocument()
    })

    it('does not render dialog content when visible is false', () => {
      renderComponent({ visible: false })
      expect(screen.queryByPlaceholderText(/search foods/i)).not.toBeInTheDocument()
    })
  })

  describe('Search', () => {
    it('shows the search input by default', () => {
      renderComponent()
      expect(screen.getByPlaceholderText(/search foods/i)).toBeInTheDocument()
    })

    it('does not call apiSearchOpenFoodFacts when query is shorter than 2 chars', async () => {
      const user = userEvent.setup()
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'a')
      await new Promise((r) => setTimeout(r, 500))
      expect(apiSearchOpenFoodFacts).not.toHaveBeenCalled()
    })

    it('calls apiSearchOpenFoodFacts after debounce when query length >= 2', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([mockProduct])
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'Greek')
      await waitFor(() => expect(apiSearchOpenFoodFacts).toHaveBeenCalledWith('Greek'), { timeout: 1000 })
    })

    it('displays search results', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([mockProduct])
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'Greek')
      await waitFor(() => expect(screen.getByText('Greek Yogurt')).toBeInTheDocument(), { timeout: 1000 })
    })

    it('shows "No results found" error when search returns empty', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([])
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'xyznothing')
      await waitFor(() => expect(screen.getByText(/no results found/i)).toBeInTheDocument(), { timeout: 1000 })
    })

    it('shows search error message when apiSearchOpenFoodFacts throws', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockRejectedValue(new Error('Network error'))
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'yogurt')
      await waitFor(() => expect(screen.getByText(/search failed/i)).toBeInTheDocument(), { timeout: 1000 })
    })

    it('shows "Searching…" while loading', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockReturnValue(new Promise(() => {}))
      renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'yogurt')
      await waitFor(() => expect(screen.getByText(/searching/i)).toBeInTheDocument(), { timeout: 1000 })
    })
  })

  describe('Import action', () => {
    async function renderWithResults() {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([mockProduct])
      const handlers = renderComponent()
      await user.type(screen.getByPlaceholderText(/search foods/i), 'Greek')
      await waitFor(() => expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument(), {
        timeout: 1000,
      })
      return { user, ...handlers }
    }

    it('calls apiCreateFood and then onImport and onHide on successful import', async () => {
      const { user, onImport, onHide } = await renderWithResults()
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await waitFor(() => expect(apiCreateFood).toHaveBeenCalledWith(mockMappedFood))
      expect(onImport).toHaveBeenCalledWith(mockCreatedFood)
      expect(onHide).toHaveBeenCalled()
    })

    it('shows an error and does not call onImport when apiCreateFood fails', async () => {
      vi.mocked(apiCreateFood).mockRejectedValue(new Error('Already exists'))
      const { user, onImport, onHide } = await renderWithResults()
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await waitFor(() => expect(screen.getByText(/failed to import/i)).toBeInTheDocument())
      expect(onImport).not.toHaveBeenCalled()
      expect(onHide).not.toHaveBeenCalled()
    })

    it('shows "Importing…" on the button while in-flight', async () => {
      vi.mocked(apiCreateFood).mockReturnValue(new Promise(() => {}))
      const { user } = await renderWithResults()
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled()
    })
  })

  describe('State reset on hide', () => {
    it('resets search query and results when visible changes to false', async () => {
      const user = userEvent.setup()
      vi.mocked(apiSearchOpenFoodFacts).mockResolvedValue([mockProduct])
      const { rerender } = render(
        <OpenFoodFactsImport visible={true} onHide={vi.fn()} onImport={vi.fn()} />
      )
      await user.type(screen.getByPlaceholderText(/search foods/i), 'Greek')
      await waitFor(() => expect(screen.getByText('Greek Yogurt')).toBeInTheDocument(), { timeout: 1000 })

      rerender(<OpenFoodFactsImport visible={false} onHide={vi.fn()} onImport={vi.fn()} />)
      rerender(<OpenFoodFactsImport visible={true} onHide={vi.fn()} onImport={vi.fn()} />)

      expect(screen.getByPlaceholderText(/search foods/i)).toHaveValue('')
      expect(screen.queryByText('Greek Yogurt')).not.toBeInTheDocument()
    })
  })
})
