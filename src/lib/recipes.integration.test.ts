import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { getRecipes, getRecipeBySlug, createRecipe, updateRecipe, deleteRecipe, saveRecipe, unsaveRecipe, getSavedRecipes, isSaved, getTopRecipes } from './recipes'
import { createFood, deleteFood } from './foods'
import { signUp } from './users'
import type { Food } from '@/types/Food'
import type { User } from '@/types/User'

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({ connectionString })

let testFood: Food
let testUser: User

async function cleanupRecipes() {
  await pool.query(`DELETE FROM "saved_recipes" WHERE recipe_id IN (SELECT id FROM "recipes" WHERE name LIKE 'Test%')`)
  await pool.query(`DELETE FROM "recipes" WHERE name LIKE 'Test%'`)
}

async function cleanupUsers() {
  await pool.query(`DELETE FROM "users" WHERE username LIKE 'testuser_%'`)
}

describe('recipes data layer (integration)', () => {
  beforeAll(async () => {
    testFood = await createFood({
      name: 'Test Ingredient Food',
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
      fiber: 1,
      servingSize: 100,
      servingUnit: 'g',
      measurements: ['g'],
    })
    testUser = await signUp({
      username: `testuser_${Date.now()}`,
      email: `testuser_${Date.now()}@example.com`,
      password: 'Password1!',
      cuisinePreferences: [],
      dietaryRestrictions: [],
    })
  })

  afterEach(async () => {
    await cleanupRecipes()
  })

  afterAll(async () => {
    if (testFood?.id) await deleteFood(testFood.id)
    await cleanupUsers()
    await pool.end()
  })

  it('creates and retrieves a recipe', async () => {
    const created = await createRecipe({
      name: 'Test Pasta',
      meal: 'Dinner',
      description: 'A test pasta dish',
      ingredients: [{ food: testFood, quantity: 200, calories: 200, servingUnit: 'g' }],
      date_published: null,
      isPublic: true,
    })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('Test Pasta')
    expect(created.ingredients).toHaveLength(1)
    expect(created.ingredients[0].food.name).toBe('Test Ingredient Food')

    const fetched = await getRecipeBySlug('test-pasta')
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Test Pasta')
  })

  it('lists public recipes without a viewer', async () => {
    await createRecipe({ name: 'Test Public Salad', meal: 'Lunch', description: '', ingredients: [], date_published: new Date(), isPublic: true })
    await createRecipe({ name: 'Test Private Soup', meal: 'Dinner', description: '', ingredients: [], date_published: null, isPublic: false })

    const all = await getRecipes()
    const testResults = all.filter(r => r.name.startsWith('Test'))
    expect(testResults.some(r => r.name === 'Test Public Salad')).toBe(true)
    expect(testResults.some(r => r.name === 'Test Private Soup')).toBe(false)
  })

  it('lists own private recipes when viewerId is provided', async () => {
    const userId = Number(testUser.id)
    await createRecipe({ name: 'Test Owner Private', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: false, userId })
    await createRecipe({ name: 'Test Other Private', meal: 'Dinner', description: '', ingredients: [], date_published: null, isPublic: false })

    const results = await getRecipes({ viewerId: userId })
    const testResults = results.filter(r => r.name.startsWith('Test'))
    expect(testResults.some(r => r.name === 'Test Owner Private')).toBe(true)
    expect(testResults.some(r => r.name === 'Test Other Private')).toBe(false)
  })

  it('filters recipes by published status', async () => {
    const now = new Date()
    await createRecipe({ name: 'Test Published', meal: 'Lunch', description: '', ingredients: [], date_published: now, isPublic: true })
    await createRecipe({ name: 'Test Draft', meal: 'Dinner', description: '', ingredients: [], date_published: null, isPublic: true })

    const published = await getRecipes({ published: true })
    const testPublished = published.filter(r => r.name.startsWith('Test'))
    expect(testPublished.every(r => r.date_published !== null)).toBe(true)

    const drafts = await getRecipes({ published: false })
    const testDrafts = drafts.filter(r => r.name.startsWith('Test'))
    expect(testDrafts.every(r => r.date_published === null)).toBe(true)
  })

  it('filters recipes by ingredient', async () => {
    await createRecipe({
      name: 'Test With Ingredient',
      meal: 'Dinner',
      description: '',
      ingredients: [{ food: testFood, quantity: 100, calories: 100, servingUnit: 'g' }],
      date_published: new Date(),
      isPublic: true,
    })
    await createRecipe({ name: 'Test Without Ingredient', meal: 'Lunch', description: '', ingredients: [], date_published: new Date(), isPublic: true })

    const results = await getRecipes({ ingredient: 'test ingredient food' })
    const testResults = results.filter(r => r.name.startsWith('Test'))
    expect(testResults.length).toBeGreaterThanOrEqual(1)
    expect(testResults.some(r => r.name === 'Test With Ingredient')).toBe(true)
    expect(testResults.some(r => r.name === 'Test Without Ingredient')).toBe(false)
  })

  it('updates a recipe', async () => {
    const created = await createRecipe({ name: 'Test UpdateMe', meal: 'Lunch', description: 'old', ingredients: [], date_published: null, isPublic: true })
    const updated = await updateRecipe(created.id, { description: 'new description' })
    expect(updated?.description).toBe('new description')
    expect(updated?.name).toBe('Test UpdateMe')
  })

  it('soft-deletes a recipe', async () => {
    const created = await createRecipe({ name: 'Test DeleteMe', meal: 'Snack', description: '', ingredients: [], date_published: null, isPublic: true })
    const deleted = await deleteRecipe(created.id)
    expect(deleted).toBe(true)

    const fetched = await getRecipeBySlug('test-deleteme')
    expect(fetched).toBeNull()
  })

  describe('saved recipes', () => {
    it('saves and retrieves a public recipe', async () => {
      const recipe = await createRecipe({ name: 'Test Saveable', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: true })
      const userId = Number(testUser.id)

      await saveRecipe(userId, recipe.id)
      expect(await isSaved(userId, recipe.id)).toBe(true)

      const saved = await getSavedRecipes(userId)
      expect(saved.some(r => r.id === recipe.id)).toBe(true)
    })

    it('unsaves a recipe', async () => {
      const recipe = await createRecipe({ name: 'Test UnsaveMe', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: true })
      const userId = Number(testUser.id)

      await saveRecipe(userId, recipe.id)
      expect(await isSaved(userId, recipe.id)).toBe(true)

      await unsaveRecipe(userId, recipe.id)
      expect(await isSaved(userId, recipe.id)).toBe(false)

      const saved = await getSavedRecipes(userId)
      expect(saved.some(r => r.id === recipe.id)).toBe(false)
    })

    it('re-saving a previously unsaved recipe works', async () => {
      const recipe = await createRecipe({ name: 'Test ResaveMe', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: true })
      const userId = Number(testUser.id)

      await saveRecipe(userId, recipe.id)
      await unsaveRecipe(userId, recipe.id)
      await saveRecipe(userId, recipe.id)

      expect(await isSaved(userId, recipe.id)).toBe(true)
    })

    it('revokes saved bookmarks when recipe is made private via updateRecipe', async () => {
      const recipe = await createRecipe({ name: 'Test RevokeMe', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: true })
      const userId = Number(testUser.id)

      await saveRecipe(userId, recipe.id)
      expect(await isSaved(userId, recipe.id)).toBe(true)

      await updateRecipe(recipe.id, { isPublic: false })
      expect(await isSaved(userId, recipe.id)).toBe(false)

      const saved = await getSavedRecipes(userId)
      expect(saved.some(r => r.id === recipe.id)).toBe(false)
    })

    it('getSavedRecipes excludes private recipes as defense-in-depth', async () => {
      const recipe = await createRecipe({ name: 'Test DefenseRecipe', meal: 'Dinner', description: '', ingredients: [], date_published: null, isPublic: true })
      const userId = Number(testUser.id)

      await saveRecipe(userId, recipe.id)
      // Directly flip isPublic in DB, bypassing updateRecipe's revocation logic
      await pool.query(`UPDATE "recipes" SET "is_public" = 0 WHERE id = $1`, [recipe.id])

      const saved = await getSavedRecipes(userId)
      expect(saved.some(r => r.id === recipe.id)).toBe(false)
    })
  })

  describe('getTopRecipes', () => {
    it('returns public published recipes ordered by save count descending', async () => {
      const userId = Number(testUser.id)
      const published = new Date()

      const [r1, r2, r3] = await Promise.all([
        createRecipe({ name: 'Test Top One', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test Top Two', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test Top Three', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
      ])

      // r2 saved twice, r1 once, r3 zero times
      await saveRecipe(userId, r2.id)
      const userId2 = Number((await signUp({ username: `testuser_top_${Date.now()}`, email: `testuser_top_${Date.now()}@example.com`, password: 'Password1!', cuisinePreferences: [], dietaryRestrictions: [] })).id)
      await saveRecipe(userId2, r2.id)
      await saveRecipe(userId, r1.id)

      const top = await getTopRecipes(3)
      const topIds = top.map(r => r.id)
      expect(topIds.indexOf(r2.id)).toBeLessThan(topIds.indexOf(r1.id))
      expect(topIds.indexOf(r1.id)).toBeLessThan(topIds.indexOf(r3.id))
    })

    it('respects the limit parameter', async () => {
      const published = new Date()
      await Promise.all([
        createRecipe({ name: 'Test Limit A', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test Limit B', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test Limit C', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
      ])

      const top = await getTopRecipes(2)
      expect(top.length).toBeLessThanOrEqual(2)
    })

    it('excludes unpublished and private recipes', async () => {
      await Promise.all([
        createRecipe({ name: 'Test Unpublished', meal: 'Lunch', description: '', ingredients: [], date_published: null, isPublic: true }),
        createRecipe({ name: 'Test Private', meal: 'Lunch', description: '', ingredients: [], date_published: new Date(), isPublic: false }),
      ])

      const top = await getTopRecipes(10)
      expect(top.some(r => r.name === 'Test Unpublished')).toBe(false)
      expect(top.some(r => r.name === 'Test Private')).toBe(false)
    })
  })

  describe('getSavedRecipes with limit', () => {
    it('returns only the most recently saved recipes up to the limit', async () => {
      const userId = Number(testUser.id)
      const published = new Date()

      const [r1, r2, r3] = await Promise.all([
        createRecipe({ name: 'Test SavedOrder A', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test SavedOrder B', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
        createRecipe({ name: 'Test SavedOrder C', meal: 'Lunch', description: '', ingredients: [], date_published: published, isPublic: true }),
      ])

      await saveRecipe(userId, r1.id)
      await saveRecipe(userId, r2.id)
      await saveRecipe(userId, r3.id)

      const saved = await getSavedRecipes(userId, 2)
      expect(saved).toHaveLength(2)
      // Most recently saved (r3, r2) should appear; r1 should be excluded
      expect(saved.some(r => r.id === r3.id)).toBe(true)
      expect(saved.some(r => r.id === r2.id)).toBe(true)
      expect(saved.some(r => r.id === r1.id)).toBe(false)
    })
  })
})
