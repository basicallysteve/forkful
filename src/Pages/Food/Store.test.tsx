import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Store from './Store'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import type { Food } from '@/types/Food'

const mockFoods: Food[] = [
  {
    id: 1,
    name: 'Chicken Breast',
    calories: 165,
    macronutrients: { protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    servingSize: 100,
    servingUnit: 'g',
    measurements: ['g', 'oz'],
  },
  {
    id: 2,
    name: 'Brown Rice',
    calories: 216,
    macronutrients: { protein: 5, carbs: 45, fat: 1.8, fiber: 3.5 },
    servingSize: 1,
    servingUnit: 'cup',
    measurements: ['cup', 'g'],
  },
]

function renderWithProviders(
  ui: React.ReactElement,
  {
    foods = mockFoods,
    setFoods = vi.fn(),
    addFood = vi.fn().mockImplementation((food) => ({ ...food, id: 999 })),
    updateFood = vi.fn(),
    deleteFood = vi.fn().mockReturnValue(true),
    isFoodUsedInRecipe = vi.fn().mockReturnValue(false),
    getFoodByName = vi.fn(),
  }: Partial<FoodContextType> = {}
) {
  const contextValue: FoodContextType = {
    foods,
    setFoods,
    addFood,
    updateFood,
    deleteFood,
    isFoodUsedInRecipe,
    getFoodByName,
  }

  return render(
    <BrowserRouter>
      <GlobalFoodContext.Provider value={contextValue}>
        {ui}
      </GlobalFoodContext.Provider>
    </BrowserRouter>
  )
}

describe('Food Store Page - Add Food', () => {
  describe('Basic Rendering', () => {
    it('renders the page title for new food', () => {
      renderWithProviders(<Store />)
      expect(screen.getByText('Add New Food')).toBeInTheDocument()
    })

    it('renders the page title for editing food', () => {
      renderWithProviders(<Store existingFood={mockFoods[0]} />)
      expect(screen.getByText('Edit Food')).toBeInTheDocument()
    })

    it('renders all form fields', () => {
      renderWithProviders(<Store />)
      expect(screen.getByPlaceholderText('e.g. Chicken Breast')).toBeInTheDocument()
      expect(screen.getByLabelText('Calories')).toBeInTheDocument()
      expect(screen.getByLabelText('Serving size')).toBeInTheDocument()
      expect(screen.getByLabelText('Serving unit')).toBeInTheDocument()
      expect(screen.getByLabelText('Protein')).toBeInTheDocument()
      expect(screen.getByLabelText('Carbohydrates')).toBeInTheDocument()
      expect(screen.getByLabelText('Fat')).toBeInTheDocument()
      expect(screen.getByLabelText('Fiber')).toBeInTheDocument()
    })
  })

  describe('Duplicate Name Validation', () => {
    it('shows error when food name matches existing food (exact match)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'Chicken Breast')

      expect(screen.getByRole('alert')).toHaveTextContent('A food with this name already exists.')
      expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('shows error when food name matches existing food (case-insensitive)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'CHICKEN BREAST')

      expect(screen.getByRole('alert')).toHaveTextContent('A food with this name already exists.')
    })

    it('does not show error for unique food name', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'Unique Food Name')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(nameInput).toHaveAttribute('aria-invalid', 'false')
    })

    it('allows editing food to keep its own name', async () => {
      renderWithProviders(<Store existingFood={mockFoods[0]} />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      expect(nameInput).toHaveValue('Chicken Breast')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('Save button is disabled when name is empty', () => {
      renderWithProviders(<Store />)

      const saveButton = screen.getByRole('button', { name: /save food/i })
      expect(saveButton).toBeDisabled()
    })

    it('Save button is enabled when all required fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'New Food Item')

      const caloriesInput = screen.getByLabelText('Calories')
      await user.clear(caloriesInput)
      await user.type(caloriesInput, '100')

      const saveButton = screen.getByRole('button', { name: /save food/i })
      expect(saveButton).not.toBeDisabled()
    })

    it('disables Save button when duplicate name exists', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'Chicken Breast')

      const saveButton = screen.getByRole('button', { name: /save food/i })
      expect(saveButton).toBeDisabled()
    })
  })

  describe('Macronutrient Input', () => {
    it('allows entering macronutrient values', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const proteinInput = screen.getByLabelText('Protein')
      await user.clear(proteinInput)
      await user.type(proteinInput, '25')

      expect(proteinInput).toHaveValue(25)
    })

    it('prevents negative macronutrient values', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const proteinInput = screen.getByLabelText('Protein')
      expect(proteinInput).toHaveAttribute('min', '0')
    })
  })

  describe('Measurements Management', () => {
    it('displays existing measurements as tags', () => {
      renderWithProviders(<Store existingFood={mockFoods[0]} />)

      const measurementTags = document.querySelectorAll('.measurement-tag')
      const tagTexts = Array.from(measurementTags).map(tag => tag.textContent?.replace('×', '').trim())
      expect(tagTexts).toContain('g')
      expect(tagTexts).toContain('oz')
    })

    it('allows adding new measurements', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store />)

      const measurementInput = screen.getByPlaceholderText('Add measurement (e.g. cup, tbsp)')
      await user.type(measurementInput, 'custom')

      const addButton = screen.getByRole('button', { name: /^add$/i })
      await user.click(addButton)

      const measurementTags = document.querySelectorAll('.measurement-tag')
      const tagTexts = Array.from(measurementTags).map(tag => tag.textContent?.replace('×', '').trim())
      expect(tagTexts).toContain('custom')
    })

    it('allows removing measurements', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Store existingFood={mockFoods[0]} />)

      const removeGramButton = screen.getByRole('button', { name: /remove g/i })
      await user.click(removeGramButton)

      // Check measurement tags specifically, not the select dropdown
      const measurementTags = document.querySelectorAll('.measurement-tag')
      const tagTexts = Array.from(measurementTags).map(tag => tag.textContent?.replace('×', '').trim())
      expect(tagTexts).not.toContain('g')
      expect(tagTexts).toContain('oz') // oz should still be there
    })
  })

  describe('Save Functionality', () => {
    it('calls addFood when saving a new food', async () => {
      const user = userEvent.setup()
      const addFood = vi.fn().mockImplementation((food) => ({ ...food, id: 999 }))
      renderWithProviders(<Store />, { addFood })

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.type(nameInput, 'New Food')

      const caloriesInput = screen.getByLabelText('Calories')
      await user.clear(caloriesInput)
      await user.type(caloriesInput, '150')

      const saveButton = screen.getByRole('button', { name: /save food/i })
      await user.click(saveButton)

      expect(addFood).toHaveBeenCalledTimes(1)
      expect(addFood).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Food',
          calories: 150,
        })
      )
    })

    it('calls updateFood when saving an edited food', async () => {
      const user = userEvent.setup()
      const updateFood = vi.fn()
      renderWithProviders(<Store existingFood={mockFoods[0]} />, { updateFood })

      const nameInput = screen.getByPlaceholderText('e.g. Chicken Breast')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Chicken')

      const saveButton = screen.getByRole('button', { name: /update food/i })
      await user.click(saveButton)

      expect(updateFood).toHaveBeenCalledTimes(1)
      expect(updateFood).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Updated Chicken',
        })
      )
    })
  })

  describe('Cancel Functionality', () => {
    it('renders cancel button', () => {
      renderWithProviders(<Store />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })
})
