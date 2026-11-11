import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { createFoodLogEntry, getDailyLog } from './foodLog'
import { createFood } from './foods'
import { signUp } from './users'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({ connectionString })

async function cleanup() {
  await pool.query(`DELETE FROM food_log_entries WHERE food_id IN (SELECT id FROM foods WHERE name LIKE 'TestLog%')`)
  await pool.query(`DELETE FROM food_log_entries WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'testlog%')`)
  await pool.query(`DELETE FROM foods WHERE name LIKE 'TestLog%'`)
  await pool.query(`DELETE FROM users WHERE username LIKE 'testlog%'`)
}

async function createTestUser(suffix: string) {
  const user = await signUp({
    username: `testlog${suffix}`,
    email: `testlog${suffix}@test.com`,
    password: 'password123',
    cuisinePreferences: [],
    dietaryRestrictions: [],
  })
  return { ...user, id: Number(user.id) }
}

async function createTestFood() {
  return createFood({
    name: 'TestLog Chicken',
    calories: 200,
    protein: 30,
    carbs: 0,
    fat: 8,
    fiber: 0,
    servingSize: 100,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }, { unit: 'oz' }],
  })
}

describe('food log data layer (integration)', () => {
  afterEach(cleanup)
  afterAll(() => pool.end())

  it('creates an entry with the five macros frozen at log time', async () => {
    const user = await createTestUser('a')
    const food = await createTestFood()

    const entry = await createFoodLogEntry({
      userId: user.id,
      foodId: food.id,
      amount: 200,
      unit: 'g',
      logDate: '2026-08-19',
    })

    expect(entry.id).toBeDefined()
    expect(entry.calories).toBe(400)
    expect(entry.protein).toBe(60)
    expect(entry.fat).toBe(16)
    expect(entry.food?.name).toBe('TestLog Chicken')
    expect(entry.logDate).toBe('2026-08-19')
  })

  it('freezes macros against later changes to the referent Food', async () => {
    const user = await createTestUser('b')
    const food = await createTestFood()

    const entry = await createFoodLogEntry({
      userId: user.id,
      foodId: food.id,
      amount: 100,
      unit: 'g',
      logDate: '2026-08-19',
    })
    expect(entry.calories).toBe(200)

    // Bump the Food's calories after logging.
    await pool.query(`UPDATE foods SET calories = 999 WHERE id = $1`, [food.id])

    const daily = await getDailyLog(user.id, '2026-08-19')
    // The snapshot stands — the total reflects the calories at log time, not the new value.
    expect(daily.total.calories).toBe(200)
  })

  it("sums today's entries and buckets them by logDate", async () => {
    const user = await createTestUser('c')
    const food = await createTestFood()

    await createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 100, unit: 'g', logDate: '2026-08-19' })
    await createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 50, unit: 'g', logDate: '2026-08-19' })
    // A different day must not leak into today's total.
    await createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 100, unit: 'g', logDate: '2026-08-18' })

    const today = await getDailyLog(user.id, '2026-08-19')
    expect(today.entries).toHaveLength(2)
    expect(today.total.calories).toBe(300)
    expect(today.total.protein).toBe(45)
  })

  it('rejects a unit the food does not offer', async () => {
    const user = await createTestUser('f')
    const food = await createTestFood() // measurements: g, oz

    await expect(
      createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 1, unit: 'cup', logDate: '2026-08-19' })
    ).rejects.toThrow('Invalid unit')
  })

  it('nulls the referent food in the daily log once it is soft-deleted', async () => {
    const user = await createTestUser('g')
    const food = await createTestFood()

    await createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 100, unit: 'g', logDate: '2026-08-19' })
    await pool.query(`UPDATE foods SET date_deleted = now() WHERE id = $1`, [food.id])

    const daily = await getDailyLog(user.id, '2026-08-19')
    expect(daily.entries).toHaveLength(1)
    expect(daily.entries[0].food).toBeNull()
    // The frozen macros still stand — the entry survives on its snapshot.
    expect(daily.total.calories).toBe(200)
  })

  it('scopes the daily log to the requesting user', async () => {
    const userA = await createTestUser('d')
    const userB = await createTestUser('e')
    const food = await createTestFood()

    await createFoodLogEntry({ userId: userA.id, foodId: food.id, amount: 100, unit: 'g', logDate: '2026-08-19' })

    const bLog = await getDailyLog(userB.id, '2026-08-19')
    expect(bLog.entries).toHaveLength(0)
    expect(bLog.total.calories).toBe(0)
  })
})
