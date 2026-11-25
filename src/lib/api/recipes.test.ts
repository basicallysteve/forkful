import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetchRecipes, apiFetchRecipe, apiCreateRecipe, apiUpdateRecipe, apiDeleteRecipe, apiFetchSavedRecipes, apiSaveRecipe, apiUnsaveRecipe, apiIsRecipeSaved, apiFetchRecipeSteps, apiCreateRecipeStep, apiUpdateRecipeStep, apiDeleteRecipeStep, apiReorderRecipeSteps, apiUploadImage, apiScrapeRecipeFromUrl } from './recipes'
import { ForbiddenError, UnauthorizedError, isUnauthorizedError } from './errors'
import type { Recipe } from '@/types/Recipe'
import type { RecipeStep } from '@/types/RecipeStep'

const mockRecipe: Recipe = {
  id: 1,
  shortId: 'abc12345',
  name: 'Pasta',
  meal: 'Dinner',
  description: 'A pasta dish',
  ingredients: [],
  steps: [],
  date_published: null,
  isPublic: false,
  nutritionComplete: true,
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
    expect(fetch).toHaveBeenCalledWith('/api/recipes/abc12345', expect.objectContaining({ method: 'PUT' }))
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

const mockStep: RecipeStep = { id: 1, recipeId: 1, position: 0, title: 'Boil water', content: '<p>Boil it</p>' }

describe('apiFetchRecipeSteps', () => {
  it('fetches steps for a recipe', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockStep] } as Response)
    const result = await apiFetchRecipeSteps('pasta')
    expect(result).toEqual([mockStep])
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/steps')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(apiFetchRecipeSteps('pasta')).rejects.toThrow('Failed to fetch steps')
  })
})

describe('apiCreateRecipeStep', () => {
  it('posts step data and returns created step', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockStep } as Response)
    const result = await apiCreateRecipeStep('pasta', { title: 'Boil water', content: '<p>Boil it</p>' })
    expect(result).toEqual(mockStep)
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/steps', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    await expect(apiCreateRecipeStep('pasta', { content: '' })).rejects.toThrow('Failed to create step')
  })
})

describe('apiUpdateRecipeStep', () => {
  it('puts step data and returns updated step', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockStep } as Response)
    const result = await apiUpdateRecipeStep({ shortId: 'pasta', stepId: 1, data: { content: '<p>Updated</p>' } })
    expect(result).toEqual(mockStep)
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/steps/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(apiUpdateRecipeStep({ shortId: 'pasta', stepId: 1, data: {} })).rejects.toThrow('Failed to update step')
  })
})

describe('apiDeleteRecipeStep', () => {
  it('sends DELETE to step endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiDeleteRecipeStep('pasta', 1)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/recipes/pasta/steps/1', { method: 'DELETE' })
  })
})

describe('apiReorderRecipeSteps', () => {
  it('sends PATCH with orderedIds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response)
    await expect(apiReorderRecipeSteps('pasta', [3, 1, 2])).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      '/api/recipes/pasta/steps',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: [3, 1, 2] }),
      })
    )
  })
})

describe('apiUploadImage', () => {
  it('posts form data and returns url', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://blob.example.com/image.jpg' }) } as Response)
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await apiUploadImage(file)
    expect(result).toBe('https://blob.example.com/image.jpg')
    expect(fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response)
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(apiUploadImage(file)).rejects.toThrow('Failed to upload image')
  })
})

describe('recipes wrapper throws ApiError carrying status, kind and the server message', () => {
  const serverError = (status: number, error?: string) =>
    ({ ok: false, status, json: async () => (error ? { error } : {}) }) as unknown as Response

  it('read, step and save calls expose the status and kind', async () => {
    global.fetch = vi.fn().mockResolvedValue(serverError(500))
    await expect(apiFetchRecipes()).rejects.toMatchObject({ status: 500, kind: 'server' })
    await expect(apiFetchSavedRecipes()).rejects.toMatchObject({ status: 500, kind: 'server' })
    await expect(apiSaveRecipe('abc12345')).rejects.toMatchObject({ status: 500, kind: 'server' })
    await expect(apiFetchRecipeSteps('abc12345')).rejects.toMatchObject({ status: 500, kind: 'server' })
    global.fetch = vi.fn().mockResolvedValue(serverError(403))
    await expect(apiCreateRecipeStep('abc12345', { content: 'x' })).rejects.toMatchObject({ status: 403, kind: 'forbidden' })
    await expect(apiDeleteRecipeStep('abc12345', 1)).rejects.toMatchObject({ status: 403, kind: 'forbidden' })
  })

  it('a 401 from a save call is recognised by isUnauthorizedError', async () => {
    global.fetch = vi.fn().mockResolvedValue(serverError(401))
    expect(isUnauthorizedError(await apiSaveRecipe('abc12345').catch((e) => e))).toBe(true)
  })

  it("write calls surface the server's message on 400", async () => {
    global.fetch = vi.fn().mockResolvedValue(serverError(400, 'Title is required'))
    await expect(apiCreateRecipe({ ...mockRecipe } as never)).rejects.toMatchObject({ kind: 'invalid', message: 'Title is required' })
  })

  it('url import surfaces the server message and status', async () => {
    global.fetch = vi.fn().mockResolvedValue(serverError(422, 'No recipe found on that page'))
    await expect(apiScrapeRecipeFromUrl('https://example.com')).rejects.toMatchObject({ status: 422, message: 'No recipe found on that page' })
  })

  it('apiFetchRecipe still returns null on 404 but throws ApiError on 500', async () => {
    global.fetch = vi.fn().mockResolvedValue(serverError(404))
    await expect(apiFetchRecipe('abc12345')).resolves.toBeNull()
    global.fetch = vi.fn().mockResolvedValue(serverError(500))
    await expect(apiFetchRecipe('abc12345')).rejects.toMatchObject({ status: 500, kind: 'server' })
  })

  it('a network failure becomes an ApiError of kind network', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetchRecipes()).rejects.toMatchObject({ kind: 'network' })
    await expect(apiUpdateRecipe(mockRecipe)).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('recipe write failures carry their HTTP status', () => {
  it('apiUpdateRecipe throws ForbiddenError on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    await expect(apiUpdateRecipe(mockRecipe)).rejects.toBeInstanceOf(ForbiddenError)
  })
  it('apiUpdateRecipe throws UnauthorizedError on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
    await expect(apiUpdateRecipe(mockRecipe)).rejects.toBeInstanceOf(UnauthorizedError)
  })
  it('apiUpdateRecipe error exposes status 404 and 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(apiUpdateRecipe(mockRecipe)).rejects.toMatchObject({ status: 404 })
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(apiUpdateRecipe(mockRecipe)).rejects.toMatchObject({ status: 500 })
  })
  it('apiDeleteRecipe throws ForbiddenError on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    await expect(apiDeleteRecipe('abc12345')).rejects.toBeInstanceOf(ForbiddenError)
  })
})
