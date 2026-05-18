import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetchRecipes, apiFetchRecipe, apiCreateRecipe, apiUpdateRecipe, apiDeleteRecipe, apiFetchSavedRecipes, apiSaveRecipe, apiUnsaveRecipe, apiIsRecipeSaved } from './recipes'
import type { Recipe } from '@/types/Recipe'

const mockRecipe: Recipe = {
  id: 1,
  name: 'Pasta',
  meal: 'Dinner',
  description: 'A pasta dish',
  ingredients: [],
  date_published: null,
  isPublic: false,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('apiFetchRecipes', () => {
  it('fetches all recipes with no params', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockRecipe],
    } as Response)
    const result = await apiFetchRecipes()
    expect(result).toEqual([mockRecipe])
    expect(fetch).toHaveBeenCalledWith('/api/recipes')
  })

  it('appends published param', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response)
    await apiFetchRecipes({ published: true })
    expect(fetch).toHaveBeenCalledWith('/api/recipes?published=true')
  })

  it('appends ingredient param', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response)
    await apiFetchRecipes({ ingredient: 'chicken' })
    expect(fetch).toHaveBeenCalledWith('/api/recipes?ingredient=chicken')
  })

  it('appends sortBy and sortDir params', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response)
    await apiFetchRecipes({ sortBy: 'calories', sortDir: 'desc' })
    expect(fetch).toHaveBeenCalledWith('/api/recipes?sortBy=calories&sortDir=desc')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiFetchRecipes()).rejects.toThrow('Failed to fetch recipes')
  })
})

describe('apiFetchRecipe', () => {
  it('fetches a single recipe by slug', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRecipe } as Response)
    const result = await apiFetchRecipe('pasta')
    expect(result).toEqual(mockRecipe)
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta')
  })

  it('returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    const result = await apiFetchRecipe('nonexistent')
    expect(result).toBeNull()
  })
})

describe('apiCreateRecipe', () => {
  it('posts recipe data and returns created recipe', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRecipe } as Response)
    const { ...recipeData } = mockRecipe
    const result = await apiCreateRecipe(recipeData)
    expect(result).toEqual(mockRecipe)
    expect(fetch).toHaveBeenCalledWith('/api/recipes', expect.objectContaining({ method: 'POST' }))
  })
})

describe('apiUpdateRecipe', () => {
  it('puts recipe data and returns updated recipe', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRecipe } as Response)
    const result = await apiUpdateRecipe(mockRecipe)
    expect(result).toEqual(mockRecipe)
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta', expect.objectContaining({ method: 'PUT' }))
  })
})

describe('apiDeleteRecipe', () => {
  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeleteRecipe('pasta')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta', { method: 'DELETE' })
  })
})

describe('apiFetchSavedRecipes', () => {
  it('fetches saved recipes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockRecipe] } as Response)
    const result = await apiFetchSavedRecipes()
    expect(result).toEqual([mockRecipe])
    expect(fetch).toHaveBeenCalledWith('/api/recipes/saved')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
    await expect(apiFetchSavedRecipes()).rejects.toThrow('Failed to fetch saved recipes')
  })
})

describe('apiSaveRecipe', () => {
  it('posts to the save endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ saved: true }) } as Response)
    await expect(apiSaveRecipe('pasta')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/save', { method: 'POST' })
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    await expect(apiSaveRecipe('pasta')).rejects.toThrow('Failed to save recipe')
  })
})

describe('apiUnsaveRecipe', () => {
  it('sends DELETE to the save endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiUnsaveRecipe('pasta')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/save', { method: 'DELETE' })
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiUnsaveRecipe('pasta')).rejects.toThrow('Failed to unsave recipe')
  })
})

describe('apiIsRecipeSaved', () => {
  it('returns true when recipe is saved', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) } as Response)
    const result = await apiIsRecipeSaved('pasta')
    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/save')
  })

  it('returns false when recipe is not saved', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: false }) } as Response)
    const result = await apiIsRecipeSaved('pasta')
    expect(result).toBe(false)
  })

  it('returns false on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await apiIsRecipeSaved('pasta')
    expect(result).toBe(false)
  })
})
