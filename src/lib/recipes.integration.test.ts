import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { getRecipes, getRecipeBySlug, createRecipe, updateRecipe, deleteRecipe } from './recipes'
import { createFood, deleteFood } from './foods'
import type { Food } from '@/types/Food'

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({
  connectionString,
})

async function setupSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "foods" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar(255) NOT NULL,
      "calories" integer NOT NULL,
      "protein" numeric(10,2) NOT NULL DEFAULT '0',
      "carbs" numeric(10,2) NOT NULL DEFAULT '0',
      "fat" numeric(10,2) NOT NULL DEFAULT '0',
      "fiber" numeric(10,2) NOT NULL DEFAULT '0',
      "serving_size" numeric(10,2) NOT NULL DEFAULT '1',
      "serving_unit" varchar(50),
      "measurements" jsonb DEFAULT '[]',
      "date_added" timestamp DEFAULT now(),
      "date_updated" timestamp,
      "date_deleted" timestamp
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "recipes" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar(255) NOT NULL,
      "meal" varchar(50),
      "description" text,
      "date_added" timestamp DEFAULT now(),
      "date_published" timestamp,
      "date_deleted" timestamp
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ingredients" (
      "id" serial PRIMARY KEY NOT NULL,
      "recipe_id" integer NOT NULL REFERENCES "recipes"("id") ON DELETE cascade,
      "food_id" integer NOT NULL REFERENCES "foods"("id") ON DELETE cascade,
      "quantity" numeric(10,2) NOT NULL,
      "calories" integer NOT NULL,
      "serving_unit" varchar(50),
      "date_added" timestamp DEFAULT now(),
      "date_updated" timestamp,
      "date_deleted" timestamp
    )
  `)
}

let testFood: Food

async function cleanupRecipes() {
  await pool.query(`DELETE FROM "recipes" WHERE name LIKE 'Test%'`)
}

describe('recipes data layer (integration)', () => {
  beforeAll(async () => {
    await setupSchema()
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
  })

  afterEach(async () => {
    await cleanupRecipes()
  })

  afterAll(async () => {
    if (testFood?.id) {
      await deleteFood(testFood.id)
    }
    await pool.end()
  })

  it('creates and retrieves a recipe', async () => {
    const created = await createRecipe({
      name: 'Test Pasta',
      meal: 'Dinner',
      description: 'A test pasta dish',
      ingredients: [{ food: testFood, quantity: 200, calories: 200, servingUnit: 'g' }],
      date_published: null,
    })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('Test Pasta')
    expect(created.ingredients).toHaveLength(1)
    expect(created.ingredients[0].food.name).toBe('Test Ingredient Food')

    const fetched = await getRecipeBySlug('test-pasta')
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Test Pasta')
  })

  it('lists all recipes', async () => {
    await createRecipe({ name: 'Test Salad', meal: 'Lunch', description: 'A salad', ingredients: [], date_published: null })
    await createRecipe({ name: 'Test Soup', meal: 'Dinner', description: 'A soup', ingredients: [], date_published: null })

    const recipes = await getRecipes()
    const testRecipes = recipes.filter(r => r.name.startsWith('Test'))
    expect(testRecipes.length).toBeGreaterThanOrEqual(2)
  })

  it('filters recipes by published status', async () => {
    const now = new Date()
    await createRecipe({ name: 'Test Published', meal: 'Lunch', description: '', ingredients: [], date_published: now })
    await createRecipe({ name: 'Test Draft', meal: 'Dinner', description: '', ingredients: [], date_published: null })

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
      date_published: null,
    })
    await createRecipe({ name: 'Test Without Ingredient', meal: 'Lunch', description: '', ingredients: [], date_published: null })

    const results = await getRecipes({ ingredient: 'test ingredient food' })
    const testResults = results.filter(r => r.name.startsWith('Test'))
    expect(testResults.length).toBeGreaterThanOrEqual(1)
    expect(testResults.some(r => r.name === 'Test With Ingredient')).toBe(true)
    expect(testResults.some(r => r.name === 'Test Without Ingredient')).toBe(false)
  })

  it('updates a recipe', async () => {
    const created = await createRecipe({ name: 'Test UpdateMe', meal: 'Lunch', description: 'old', ingredients: [], date_published: null })
    const updated = await updateRecipe(created.id, { description: 'new description' })
    expect(updated?.description).toBe('new description')
    expect(updated?.name).toBe('Test UpdateMe')
  })

  it('soft-deletes a recipe', async () => {
    const created = await createRecipe({ name: 'Test DeleteMe', meal: 'Snack', description: '', ingredients: [], date_published: null })
    const deleted = await deleteRecipe(created.id)
    expect(deleted).toBe(true)

    const fetched = await getRecipeBySlug('test-deleteme')
    expect(fetched).toBeNull()
  })
})
