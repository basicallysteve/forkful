import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('recipe-scrapers', () => ({ scrapeRecipe: vi.fn() }))

// In-memory stand-in for Postgres with real transaction semantics: writes made
// inside db.transaction() are discarded when the callback throws. Writes made
// directly on `db` (outside a transaction) persist immediately, like autocommit.
// Inserting an ingredient whose food does not exist raises a FK violation (23503).
const state = vi.hoisted(() => ({
  recipes: [] as Record<string, unknown>[],
  ingredients: [] as Record<string, unknown>[],
  foodIds: new Set<number>([1]),
}))

vi.mock('@/db', async () => {
  const { recipes, ingredients } = await import('@/db/schema')
  const makeClient = () => ({
    insert: (table: unknown) => ({
      values: (v: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(v) ? v : [v]
        const run = () => {
          if (table === recipes) {
            const stored = rows.map((r, i) => ({ ...r, id: state.recipes.length + i + 1 }))
            state.recipes.push(...stored)
            return stored
          }
          if (table === ingredients) {
            for (const r of rows) {
              if (!state.foodIds.has(r.foodId as number)) {
                throw Object.assign(new Error('violates foreign key constraint "ingredients_food_id_foods_id_fk"'), { code: '23503' })
              }
            }
            state.ingredients.push(...rows)
          }
          return rows
        }
        return {
          returning: async () => run(),
          then: (res: (x: unknown) => void, rej: (e: unknown) => void) => {
            try { res(run()) } catch (e) { rej(e) }
          },
        }
      },
    }),
    update: () => ({
      set: (s: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => { Object.assign(state.recipes[0] ?? {}, s); return state.recipes.slice(0, 1) },
          then: (res: (x: unknown) => void) => { Object.assign(state.recipes[0] ?? {}, s); res(undefined) },
        }),
      }),
    }),
    delete: () => ({ where: async () => { state.ingredients.length = 0 } }),
    select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => [] }), where: () => ({ orderBy: async () => [] }) }) }),
  })
  return {
    db: {
      ...makeClient(),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const snapshot = { r: [...state.recipes], i: [...state.ingredients] }
        try {
          return await fn(makeClient())
        } catch (e) {
          state.recipes = snapshot.r
          state.ingredients = snapshot.i
          throw e
        }
      },
    },
  }
})

import { createRecipe, updateRecipe } from './recipes'
import type { CreateRecipeInput } from '@/types/Recipe'

function ingredient(foodId: number) {
  return { food: { id: foodId }, quantity: 1, servingUnit: 'g', calories: 10 }
}

function input(foodId: number): CreateRecipeInput {
  return { name: 'Test Atomic', meal: 'dinner', description: '', ingredients: [ingredient(foodId)] } as unknown as CreateRecipeInput
}

describe('recipe writes are atomic', () => {
  beforeEach(() => {
    state.recipes = []
    state.ingredients = []
    state.foodIds = new Set([1])
  })

  it('createRecipe with an unknown food id rejects and leaves no recipe row', async () => {
    await expect(createRecipe(input(999))).rejects.toMatchObject({ code: '23503' })
    expect(state.recipes).toHaveLength(0)
    expect(state.ingredients).toHaveLength(0)
  })

  it('updateRecipe with an unknown food id rejects and keeps the previous ingredients', async () => {
    state.recipes.push({ id: 1, name: 'Test Existing' })
    state.ingredients.push({ recipeId: 1, foodId: 1, quantity: '2', servingUnit: 'g' })

    await expect(updateRecipe(1, { ingredients: [ingredient(999)] } as never)).rejects.toMatchObject({ code: '23503' })
    expect(state.ingredients).toEqual([{ recipeId: 1, foodId: 1, quantity: '2', servingUnit: 'g' }])
  })
})
