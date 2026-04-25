import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { getFoods, getFoodBySlug, createFood, updateFood, deleteFood } from './foods'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
}

async function cleanupFoods() {
  await pool.query(`DELETE FROM "foods" WHERE name LIKE 'Test%'`)
}

describe('foods data layer (integration)', () => {
  beforeAll(async () => {
    await setupSchema()
  })

  afterEach(async () => {
    await cleanupFoods()
  })

  afterAll(async () => {
    await pool.end()
  })

  it('creates and retrieves a food', async () => {
    const created = await createFood({
      name: 'Test Apple',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      fiber: 4,
      servingSize: 1,
      servingUnit: 'medium',
      measurements: ['medium', 'g'],
    })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('Test Apple')
    expect(created.calories).toBe(95)

    const fetched = await getFoodBySlug('test-apple')
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Test Apple')
  })

  it('lists all foods', async () => {
    await createFood({ name: 'Test Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, servingSize: 1, servingUnit: 'medium', measurements: [] })
    await createFood({ name: 'Test Cherry', calories: 50, protein: 1, carbs: 12, fat: 0.3, fiber: 1.6, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz'] })

    const foods = await getFoods()
    const testFoods = foods.filter(f => f.name.startsWith('Test'))
    expect(testFoods.length).toBeGreaterThanOrEqual(2)
  })

  it('filters foods by search term', async () => {
    await createFood({ name: 'Test Mango', calories: 100, protein: 1, carbs: 25, fat: 0, fiber: 2, servingSize: 1, servingUnit: 'piece', measurements: [] })
    await createFood({ name: 'Test Grape', calories: 62, protein: 0.6, carbs: 16, fat: 0.3, fiber: 0.8, servingSize: 100, servingUnit: 'g', measurements: [] })

    const results = await getFoods({ search: 'mango' })
    const testResults = results.filter(f => f.name.startsWith('Test'))
    expect(testResults.length).toBe(1)
    expect(testResults[0].name).toBe('Test Mango')
  })

  it('sorts foods by calories ascending', async () => {
    await createFood({ name: 'Test LowCal', calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })
    await createFood({ name: 'Test HighCal', calories: 500, protein: 10, carbs: 50, fat: 20, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })

    const sorted = await getFoods({ sortBy: 'calories', sortDir: 'asc' })
    const testSorted = sorted.filter(f => f.name.startsWith('Test'))
    for (let i = 0; i < testSorted.length - 1; i++) {
      expect(testSorted[i].calories).toBeLessThanOrEqual(testSorted[i + 1].calories)
    }
  })

  it('updates a food', async () => {
    const created = await createFood({ name: 'Test UpdateMe', calories: 100, protein: 1, carbs: 10, fat: 1, fiber: 0.5, servingSize: 1, servingUnit: 'g', measurements: [] })
    const updated = await updateFood(created.id, { calories: 200 })
    expect(updated?.calories).toBe(200)
    expect(updated?.name).toBe('Test UpdateMe')
  })

  it('deletes a food', async () => {
    const created = await createFood({ name: 'Test DeleteMe', calories: 50, protein: 1, carbs: 5, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })
    const deleted = await deleteFood(created.id)
    expect(deleted).toBe(true)

    const fetched = await getFoodBySlug('test-deleteme')
    expect(fetched).toBeNull()
  })
})
