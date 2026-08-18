import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

const scrapeMock = vi.fn()

vi.mock('@/lib/api/recipes', () => ({
  apiScrapeRecipeFromUrl: (url: string) => scrapeMock(url),
}))

// Stub the shared preview so this test focuses on the URL/scrape stage only
vi.mock('./RecipeImportPreview', () => ({
  default: ({ parsed, onBack }: { parsed: ParsedRecipe; onBack: () => void }) =>
    React.createElement('div', { 'data-testid': 'preview-stub' }, [
      React.createElement('span', { key: 't' }, parsed.title),
      React.createElement('button', { key: 'b', type: 'button', onClick: onBack }, 'stub-back'),
    ]),
}))

const { default: RecipeImporter } = await import('./RecipeImporter')

const sampleParsed: ParsedRecipe = {
  title: 'Scraped Pancakes',
  meal: 'Breakfast',
  serves: 4,
  prepTime: 10,
  cookTime: 15,
  description: 'Fluffy.',
  ingredients: [],
  steps: [],
}

describe('RecipeImporter', () => {
  beforeEach(() => {
    scrapeMock.mockReset()
  })

  it('disables Import until a valid URL is entered', () => {
    render(React.createElement(RecipeImporter))
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled()
  })

  it('scrapes and shows the preview on success', async () => {
    scrapeMock.mockResolvedValue(sampleParsed)
    const user = userEvent.setup()
    render(React.createElement(RecipeImporter))

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), 'example.com/pancakes')
    await user.click(screen.getByRole('button', { name: /^import$/i }))

    const preview = await screen.findByTestId('preview-stub')
    expect(preview).toHaveTextContent('Scraped Pancakes')
    expect(scrapeMock).toHaveBeenCalledWith('https://example.com/pancakes')
  })

  it('shows an inline error and stays on the URL input when scraping fails', async () => {
    scrapeMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(React.createElement(RecipeImporter))

    await user.type(screen.getByPlaceholderText('https://example.com/recipe'), 'example.com/bad')
    await user.click(screen.getByRole('button', { name: /^import$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByTestId('preview-stub')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://example.com/recipe')).toBeInTheDocument()
  })
})
