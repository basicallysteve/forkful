import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeImportPreview from './RecipeImportPreview'
import { apiCreateRecipe } from '@/lib/api/recipes'
import type { Food } from '@/types/Food'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

vi.mock('@/lib/api/recipes', () => ({
  apiCreateRecipe: vi.fn(async (r) => ({ ...r, id: 9, shortId: 'abc12345' })),
  apiCreateRecipeStep: vi.fn(async () => ({})),
}))
vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: vi.fn(async () => []),
}))

const base = { protein: 0, carbs: 0, fat: 0, fiber: 0 }

const cases: { name: string; food: Food; quantity: number; unit: string; expected: number }[] = [
  { name: 'grams', food: { id: 1, name: 'Pasta', ...base, calories: 350, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }] }, quantity: 200, unit: 'g', expected: 700 },
  { name: 'ounces', food: { id: 2, name: 'Pasta', ...base, calories: 350, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }] }, quantity: 4, unit: 'oz', expected: 396.893 },
  { name: 'a gram-calibrated slice', food: { id: 3, name: 'Loaf', ...base, calories: 70, servingSize: 28, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'slice', gramsPerUnit: 28 }] }, quantity: 3, unit: 'slice', expected: 210 },
  { name: 'an ml-calibrated scoop', food: { id: 4, name: 'Powder', ...base, calories: 400, servingSize: 100, servingUnit: 'g', density: 0.5, measurements: [{ unit: 'g' }, { unit: 'scoop', mlPerUnit: 60 }] }, quantity: 2, unit: 'scoop', expected: 240 },
  { name: 'a density cross-category unit', food: { id: 5, name: 'Oil', ...base, calories: 200, servingSize: 100, servingUnit: 'g', density: 0.8, measurements: [{ unit: 'g' }] }, quantity: 250, unit: 'ml', expected: 400 },
  { name: 'an uncalibrated unit', food: { id: 6, name: 'Widget', ...base, calories: 50, servingSize: 1, servingUnit: 'piece', measurements: [{ unit: 'piece' }, { unit: 'box' }] }, quantity: 2, unit: 'box', expected: 0 },
  { name: 'a zero serving size food', food: { id: 7, name: 'Broken', ...base, calories: 50, servingSize: 0, servingUnit: 'g', measurements: [{ unit: 'g' }] }, quantity: 5, unit: 'g', expected: 0 },
]

describe('RecipeImportPreview calories (#306)', () => {
  beforeEach(() => {
    vi.mocked(apiCreateRecipe).mockClear()
  })

  it.each(cases)('creates the recipe with the server calories for $name', async ({ food, quantity, unit, expected }) => {
    vi.mocked(global.fetch).mockImplementation(async () =>
      new Response(
        JSON.stringify({
          results: [{ raw: 'x', parsed: { quantity, unit, foodName: food.name }, status: 'matched', food }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const parsed: ParsedRecipe = {
      title: 'Import Test', meal: 'Lunch', serves: 2, prepTime: null, cookTime: null,
      description: '', ingredients: [{ raw: 'x', quantity, unit, foodName: food.name }] as ParsedRecipe['ingredients'],
      steps: [], sourceUrl: null, sourceName: null,
    } as ParsedRecipe
    const user = userEvent.setup()
    render(<RecipeImportPreview parsed={parsed} onBack={() => {}} />)

    const create = await screen.findByRole('button', { name: 'Create Recipe' })
    await waitFor(() => expect(create).toBeEnabled())
    await user.click(create)

    await waitFor(() => expect(apiCreateRecipe).toHaveBeenCalled())
    const saved = vi.mocked(apiCreateRecipe).mock.calls.at(-1)![0]
    expect(saved.ingredients[0].calories).toBeCloseTo(expected, 2)
    expect(Number.isFinite(saved.ingredients[0].calories)).toBe(true)
  })
})
