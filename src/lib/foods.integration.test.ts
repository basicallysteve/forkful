import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { getFoods, getFoodBySlug, createFood, updateFood, deleteFood } from './foods'

const databaseUrl = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`
const pool = new Pool({
  connectionString: databaseUrl,
})


async function cleanupFoods() {
  await pool.query(`DELETE FROM "foods" WHERE name LIKE 'ITest%'`)
}

describe('foods data layer (integration)', () => {
  afterEach(async () => {
    await cleanupFoods()
  })

  afterAll(async () => {
    await pool.end()
  })

  it('creates and retrieves a food', async () => {
    const created = await createFood({
      name: 'ITest Apple',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      fiber: 4,
      servingSize: 1,
      servingUnit: 'medium',
      measurements: [{ unit: 'medium' }, { unit: 'g' }],
    })
    expect(created.id).toBeDefined()
    expect(created.name).toBe('ITest Apple')
    expect(created.calories).toBe(95)

    const fetched = await getFoodBySlug('itest-apple')
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('ITest Apple')
  })

  it('lists all foods', async () => {
    await createFood({ name: 'ITest Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, servingSize: 1, servingUnit: 'medium', measurements: [] })
    await createFood({ name: 'ITest Cherry', calories: 50, protein: 1, carbs: 12, fat: 0.3, fiber: 1.6, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'oz' }] })

    const foods = await getFoods()
    const testFoods = foods.filter(f => f.name.startsWith('ITest'))
    expect(testFoods.length).toBeGreaterThanOrEqual(2)
  })

  it('filters foods by search term', async () => {
    await createFood({ name: 'ITest Mango', calories: 100, protein: 1, carbs: 25, fat: 0, fiber: 2, servingSize: 1, servingUnit: 'piece', measurements: [] })
    await createFood({ name: 'ITest Grape', calories: 62, protein: 0.6, carbs: 16, fat: 0.3, fiber: 0.8, servingSize: 100, servingUnit: 'g', measurements: [] })

    const results = await getFoods({ search: 'mango' })
    const testResults = results.filter(f => f.name.startsWith('ITest'))
    expect(testResults.length).toBe(1)
    expect(testResults[0].name).toBe('ITest Mango')
  })

  it('sorts foods by calories ascending', async () => {
    await createFood({ name: 'ITest LowCal', calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })
    await createFood({ name: 'ITest HighCal', calories: 500, protein: 10, carbs: 50, fat: 20, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })

    const sorted = await getFoods({ sortBy: 'calories', sortDir: 'asc' })
    const testSorted = sorted.filter(f => f.name.startsWith('ITest'))
    for (let i = 0; i < testSorted.length - 1; i++) {
      expect(testSorted[i].calories).toBeLessThanOrEqual(testSorted[i + 1].calories)
    }
  })

  it('updates a food', async () => {
    const created = await createFood({ name: 'ITest UpdateMe', calories: 100, protein: 1, carbs: 10, fat: 1, fiber: 0.5, servingSize: 1, servingUnit: 'g', measurements: [] })
    const updated = await updateFood(created.id, { calories: 200 })
    expect(updated?.calories).toBe(200)
    expect(updated?.name).toBe('ITest UpdateMe')
  })

  it('deletes a food', async () => {
    const created = await createFood({ name: 'ITest DeleteMe', calories: 50, protein: 1, carbs: 5, fat: 0, fiber: 0, servingSize: 1, servingUnit: 'g', measurements: [] })
    const deleted = await deleteFood(created.id)
    expect(deleted).toBe(true)

    const fetched = await getFoodBySlug('itest-deleteme')
    expect(fetched).toBeNull()
  })

  it('resets source to manual when nutritional fields change on an OFF food', async () => {
    const created = await createFood({
      name: 'ITest OFFFood',
      calories: 200,
      protein: 10,
      carbs: 30,
      fat: 5,
      fiber: 2,
      sugar: 8,
      sodium: 150,
      servingSize: 100,
      servingUnit: 'g',
      measurements: [{ unit: 'g' }],
      source: 'open_food_facts',
    })
    expect(created.source).toBe('open_food_facts')

    // Updating a nutritional field must flip source → manual
    const updated = await updateFood(created.id, { calories: 180 })
    expect(updated?.source).toBe('manual')
  })

  it('does not reset source when only non-nutritional fields change on an OFF food', async () => {
    const created = await createFood({
      name: 'ITest OFFFood2',
      calories: 200,
      protein: 10,
      carbs: 30,
      fat: 5,
      fiber: 2,
      servingSize: 100,
      servingUnit: 'g',
      measurements: [{ unit: 'g' }],
      source: 'open_food_facts',
    })
    expect(created.source).toBe('open_food_facts')

    // Updating only the name must not change the source
    const updated = await updateFood(created.id, { name: 'ITest OFFFood2 Renamed' })
    expect(updated?.source).toBe('open_food_facts')
  })
})
