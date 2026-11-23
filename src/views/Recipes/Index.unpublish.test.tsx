import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Recipes from './Index'
import { useRecipeStore, resetRecipeStore } from '@/stores/recipes'
import type { Recipe } from '@/types/Recipe'

// No mock of '@/lib/api/recipes': these tests assert the real request the page sends,
// because the server replaces a recipe's ingredients whenever the PUT body has an `ingredients` key (#336).

// The /recipes list API returns recipes without their ingredients, so the store holds `ingredients: []`.
const listRecipe = (id: number, shortId: string, name: string): Recipe => ({
  id,
  shortId,
  name,
  meal: 'Lunch',
  description: '',
  ingredients: [],
  steps: [],
  date_added: new Date('2025-11-21'),
  date_published: new Date('2025-11-22'),
  isPublic: false,
  nutritionComplete: true,
})

const recipes = [listRecipe(1, 'aaa11111', 'Ham and Cheese Sandwich'), listRecipe(2, 'bbb22222', 'Spaghetti Bolognese')]

function putCalls() {
  return vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT')
}

describe('Recipes bulk Unpublish request (#336)', () => {
  beforeEach(() => {
    resetRecipeStore()
    useRecipeStore.setState((state) => ({ ...state, recipes }))
  })

  it('sends only date_published, never an ingredients list, for each selected recipe', async () => {
    const user = userEvent.setup()
    render(<Recipes isAuthenticated />)

    await user.click(screen.getByRole('checkbox', { name: /select ham and cheese sandwich/i }))
    await user.click(screen.getByRole('checkbox', { name: /select spaghetti bolognese/i }))
    await user.click(screen.getByRole('button', { name: /unpublish/i }))

    await vi.waitFor(() => expect(putCalls()).toHaveLength(2))
    const sent = putCalls().map(([url, init]) => [String(url), JSON.parse(init?.body as string)] as const)
    expect(sent.map(([url]) => url).sort()).toEqual(['/api/recipes/aaa11111', '/api/recipes/bbb22222'])
    for (const [, body] of sent) {
      expect(body).not.toHaveProperty('ingredients')
      expect(body).not.toHaveProperty('steps')
      expect(body).toEqual({ date_published: null })
    }
  })
})
