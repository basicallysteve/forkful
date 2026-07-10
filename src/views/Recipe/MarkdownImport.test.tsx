import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetFoodStore } from '@/stores/food'
import { resetRecipeStore } from '@/stores/recipes'
import type { Food } from '@/types/Food'
import type { ParsedIngredient } from '@/utils/recipeMarkdownParser'
import type { ResolvedIngredient } from '@/types/RecipeImport'

// Mock CodeMirror — it's a heavy client-only package, not needed for behaviour tests
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange, placeholder }: { value?: string; onChange?: (v: string) => void; placeholder?: string }) =>
    React.createElement('textarea', {
      value: value ?? '',
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
      placeholder,
      'data-testid': 'markdown-editor',
    }),
}))

// Mock next/dynamic so the CodeMirror mock loads synchronously in jsdom
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    const LazyComponent = React.lazy(loader)
    return function DynamicWrapper(props: Record<string, unknown>) {
      return React.createElement(
        React.Suspense,
        { fallback: React.createElement('div', { 'data-testid': 'loading' }) },
        React.createElement(LazyComponent, props)
      )
    }
  },
}))

// Suppress the recipeLanguage module — it imports @codemirror/language which is irrelevant here
vi.mock('@/utils/recipeLanguage', () => ({ recipeLanguage: [] }))

vi.mock('@/components/FoodSearch/FoodSearch', () => ({
  default: ({ onChange, placeholder, inputAriaLabel }: {
    value: string
    localFoods: unknown[]
    onChange: (food: Food) => void
    placeholder?: string
    inputAriaLabel?: string
  }) =>
    React.createElement('input', {
      placeholder,
      'aria-label': inputAriaLabel,
      'data-testid': 'food-search',
      readOnly: true,
      value: '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        try { onChange(JSON.parse(e.target.value)) } catch { /* no-op */ }
      },
    }),
}))

vi.mock('@/lib/api/recipes', () => ({
  apiCreateRecipe: vi.fn(async (r) => ({ ...r, id: 99, shortId: 'test1234', nutritionComplete: false })),
  apiCreateRecipeStep: vi.fn(async () => ({ id: 1, recipeId: 99, position: 1, content: '' })),
}))

const mockChicken: Food = {
  id: 10,
  name: 'Chicken Breast',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }, { unit: 'oz' }],
}

const mockRice: Food = {
  id: 11,
  name: 'White Rice',
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
  servingSize: 100,
  servingUnit: 'g',
  measurements: [{ unit: 'g' }, { unit: 'cup' }],
}

// Build a per-test fetch mock so we can customise resolve-ingredients responses
function buildFetchMock(resolvedIngredients: ResolvedIngredient[]) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(url)
    if (urlStr.includes('resolve-ingredients')) {
      return new Response(JSON.stringify({ results: resolvedIngredients }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Default: echo request body (same as global setup.ts mock)
    const method = init?.method?.toUpperCase() ?? 'GET'
    const bodyStr = init?.body as string | undefined
    const body = bodyStr ? JSON.parse(bodyStr) : null
    const status = method === 'DELETE' ? 204 : 200
    const responseBody = method === 'DELETE' ? null : JSON.stringify(body ?? [])
    return new Response(responseBody, {
      status,
      headers: method !== 'DELETE' ? { 'Content-Type': 'application/json' } : {},
    })
  })
}

function makeResolved(ing: ParsedIngredient, overrides: Partial<ResolvedIngredient> = {}): ResolvedIngredient {
  return {
    raw: ing.raw,
    parsed: { quantity: ing.quantity, unit: ing.unit, foodName: ing.foodName },
    status: 'matched',
    food: mockChicken,
    ...overrides,
  }
}

// Import after mocks so dynamic is already patched
const { default: MarkdownImport } = await import('./MarkdownImport')
const { default: Store } = await import('./Store')

function renderImport() {
  resetFoodStore()
  resetRecipeStore()
  return render(React.createElement(MarkdownImport))
}

function renderStore() {
  resetFoodStore()
  resetRecipeStore()
  return render(React.createElement(Store))
}

const SAMPLE_MARKDOWN = `# Test Recipe
meal: Dinner
serves: 2

## Description
A simple test recipe.

## Ingredients
- 500g chicken breast
- 1 cup white rice

## Steps
1. Cook the chicken.
2. Cook the rice.
`

describe('Store — mode toggle', () => {
  it('shows Guided and Markdown toggle buttons', () => {
    renderStore()
    expect(screen.getByRole('button', { name: /guided mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /advanced mode/i })).toBeInTheDocument()
  })

  it('shows the guided form by default', () => {
    renderStore()
    expect(screen.getByPlaceholderText('e.g. Smoky chipotle chili')).toBeInTheDocument()
  })

  it('switches to the markdown editor when Markdown is clicked', async () => {
    const user = userEvent.setup()
    renderStore()
    await user.click(screen.getByRole('button', { name: /advanced mode/i }))
    const editor = await screen.findByTestId('markdown-editor')
    expect(editor).toBeInTheDocument()
  })

  it('restores the guided form when Guided is clicked again', async () => {
    const user = userEvent.setup()
    renderStore()
    await user.click(screen.getByRole('button', { name: /advanced mode/i }))
    await screen.findByTestId('markdown-editor')
    await user.click(screen.getByRole('button', { name: /guided mode/i }))
    expect(screen.getByPlaceholderText('e.g. Smoky chipotle chili')).toBeInTheDocument()
  })
})

describe('MarkdownImport — editor state', () => {
  beforeEach(() => {
    global.fetch = buildFetchMock([])
  })

  it('renders the markdown editor with the default template', async () => {
    renderImport()
    const editor = await screen.findByTestId('markdown-editor')
    expect(editor).toBeInTheDocument()
    expect((editor as HTMLTextAreaElement).value).toContain('# My Recipe')
  })

  it('Parse & Preview button is disabled when the editor is empty', async () => {
    const user = userEvent.setup()
    renderImport()
    const editor = await screen.findByTestId('markdown-editor')
    await user.clear(editor)
    const btn = screen.getByRole('button', { name: /parse & preview/i })
    expect(btn).toBeDisabled()
  })

  it('enables Parse & Preview when the editor has content', async () => {
    renderImport()
    await screen.findByTestId('markdown-editor')
    const btn = screen.getByRole('button', { name: /parse & preview/i })
    expect(btn).not.toBeDisabled()
  })
})

describe('MarkdownImport — preview state', () => {
  async function goToPreview(resolvedResults: ResolvedIngredient[], markdown = SAMPLE_MARKDOWN) {
    global.fetch = buildFetchMock(resolvedResults)
    const user = userEvent.setup()
    renderImport()

    const editor = await screen.findByTestId('markdown-editor')
    await user.clear(editor)
    await user.type(editor, markdown)

    const parseBtn = screen.getByRole('button', { name: /parse & preview/i })
    await user.click(parseBtn)

    // Wait for preview to appear, then for ingredient resolution to settle
    await screen.findByText('Recipe Details')
    await waitFor(() =>
      expect(screen.queryByText('Resolving ingredients…')).not.toBeInTheDocument()
    )
    return user
  }

  it('populates the name field from the markdown title', async () => {
    await goToPreview([])
    const nameInput = screen.getByDisplayValue('Test Recipe')
    expect(nameInput).toBeInTheDocument()
  })

  it('populates editable metadata fallbacks', async () => {
    await goToPreview([])
    // At least one element shows the parsed meal value
    expect(screen.getAllByText('Dinner').length).toBeGreaterThan(0)
  })

  it('shows steps parsed from the markdown', async () => {
    await goToPreview([])
    expect(screen.getByText('Cook the chicken.')).toBeInTheDocument()
    expect(screen.getByText('Cook the rice.')).toBeInTheDocument()
  })

  it('shows a matched ingredient with a green badge', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved({ raw: '- 500g chicken breast', quantity: 500, unit: 'g', foodName: 'chicken breast' }),
    ]
    await goToPreview(resolved)
    expect(screen.getByText(/✓ Chicken Breast/)).toBeInTheDocument()
  })

  it('shows candidate buttons for a candidates ingredient', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved(
        { raw: '- 1 cup rice', quantity: 1, unit: 'cup', foodName: 'rice' },
        { status: 'candidates', food: undefined, candidates: [mockRice] }
      ),
    ]
    await goToPreview(resolved)
    expect(screen.getByText('No exact match')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'White Rice' })).toBeInTheDocument()
  })

  it('selecting a candidate resolves the ingredient', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved(
        { raw: '- 1 cup rice', quantity: 1, unit: 'cup', foodName: 'rice' },
        { status: 'candidates', food: undefined, candidates: [mockRice] }
      ),
    ]
    const user = await goToPreview(resolved)
    await user.click(screen.getByRole('button', { name: 'White Rice' }))
    expect(screen.getByText(/✓ White Rice/)).toBeInTheDocument()
  })

  it('shows a search box for an unresolved ingredient', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved(
        { raw: '- 2 tsp mystery spice', quantity: 2, unit: 'tsp', foodName: 'mystery spice' },
        { status: 'unresolved', food: undefined }
      ),
    ]
    await goToPreview(resolved)
    expect(screen.getByText('Not found')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search for a food…')).toBeInTheDocument()
  })

  it('skipping an ingredient marks it as skipped', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved({ raw: '- 500g chicken breast', quantity: 500, unit: 'g', foodName: 'chicken breast' }),
    ]
    const user = await goToPreview(resolved)
    const skipBtn = screen.getByRole('button', { name: /skip ingredient/i })
    await user.click(skipBtn)
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /include ingredient/i })).toBeInTheDocument()
  })

  it('un-skipping restores the ingredient', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved({ raw: '- 500g chicken breast', quantity: 500, unit: 'g', foodName: 'chicken breast' }),
    ]
    const user = await goToPreview(resolved)
    await user.click(screen.getByRole('button', { name: /skip ingredient/i }))
    await user.click(screen.getByRole('button', { name: /include ingredient/i }))
    expect(screen.getByText(/✓ Chicken Breast/)).toBeInTheDocument()
  })

  it('Edit Markdown button returns to the editor', async () => {
    const user = await goToPreview([])
    const backBtn = screen.getByRole('button', { name: /edit markdown/i })
    await user.click(backBtn)
    expect(await screen.findByTestId('markdown-editor')).toBeInTheDocument()
  })

  it('Create Recipe button is disabled when any ingredient is unresolved and not skipped', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved(
        { raw: '- 2 tsp mystery spice', quantity: 2, unit: 'tsp', foodName: 'mystery spice' },
        { status: 'unresolved', food: undefined }
      ),
    ]
    await goToPreview(resolved)
    expect(screen.getByRole('button', { name: /create recipe/i })).toBeDisabled()
  })

  it('Create Recipe button enables after skipping an unresolved ingredient', async () => {
    const resolved: ResolvedIngredient[] = [
      makeResolved(
        { raw: '- 2 tsp mystery spice', quantity: 2, unit: 'tsp', foodName: 'mystery spice' },
        { status: 'unresolved', food: undefined }
      ),
    ]
    const user = await goToPreview(resolved)
    await user.click(screen.getByRole('button', { name: /skip ingredient/i }))
    expect(screen.getByRole('button', { name: /create recipe/i })).not.toBeDisabled()
  })

  it('Create Recipe button is disabled when the name is empty', async () => {
    const user = await goToPreview([])
    const nameInput = screen.getByDisplayValue('Test Recipe')
    await user.clear(nameInput)
    expect(screen.getByRole('button', { name: /create recipe/i })).toBeDisabled()
  })

  it('calls apiCreateRecipe and apiCreateRecipeStep on confirmation', async () => {
    const { apiCreateRecipe, apiCreateRecipeStep } = await import('@/lib/api/recipes')
    const resolved: ResolvedIngredient[] = [
      makeResolved({ raw: '- 500g chicken breast', quantity: 500, unit: 'g', foodName: 'chicken breast' }),
    ]
    const user = await goToPreview(resolved)
    await user.click(screen.getByRole('button', { name: /create recipe/i }))

    await waitFor(() => {
      expect(apiCreateRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Recipe', meal: 'Dinner', serves: 2 })
      )
      // Two steps in the template
      expect(apiCreateRecipeStep).toHaveBeenCalledTimes(2)
    })
  })
})
