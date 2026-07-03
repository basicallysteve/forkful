import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { createFood } from './foods'
import { signUp } from './users'
import { createShoppingListFoodItem, getOrCreateActiveShoppingList, getShoppingListItems } from './shoppingList'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({ connectionString })

async function cleanup() {
  await pool.query(`DELETE FROM shopping_list_items WHERE food_id IN (SELECT id FROM foods WHERE name LIKE 'TestShopping%')`)
  await pool.query(`DELETE FROM shopping_lists WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'testshopping%')`)
  await pool.query(`DELETE FROM foods WHERE name LIKE 'TestShopping%'`)
  await pool.query(`DELETE FROM users WHERE username LIKE 'testshopping%'`)
}

async function createTestUser(suffix: string) {
  return signUp({
    username: `testshopping${suffix}`,
    email: `testshopping${suffix}@test.com`,
    password: 'password123',
    cuisinePreferences: [],
    dietaryRestrictions: [],
  })
}

async function createTestFood(name = 'TestShopping Chicken') {
  return createFood({
    name,
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    servingSize: 100,
    servingUnit: 'g',
    measurements: [{ unit: 'g' }, { unit: 'oz' }],
  })
}

describe('shopping list data layer (integration)', () => {
  afterEach(cleanup)
  afterAll(() => pool.end())

  it('creates an active shopping list lazily and keeps only one active list per user', async () => {
    const user = await createTestUser('a')

    const first = await getOrCreateActiveShoppingList(user.id)
    const second = await getOrCreateActiveShoppingList(user.id)

    expect(second.id).toBe(first.id)

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM shopping_lists WHERE user_id = $1 AND status = 'active'`,
      [user.id]
    )

    expect(result.rows[0].count).toBe(1)
  })

  it('adds a food item with sourceType food and default status to_buy', async () => {
    const user = await createTestUser('b')
    const food = await createTestFood()

    const created = await createShoppingListFoodItem({
      userId: user.id,
      foodId: food.id,
      amount: 2,
      unit: 'oz',
    })

    expect(created.food.name).toBe('TestShopping Chicken')
    expect(created.sourceType).toBe('food')
    expect(created.status).toBe('to_buy')
    expect(created.amount).toBe(2)
    expect(created.unit).toBe('oz')
  })

  it('lists shopping list items for the active list', async () => {
    const user = await createTestUser('c')
    const food = await createTestFood('TestShopping Rice')

    await createShoppingListFoodItem({
      userId: user.id,
      foodId: food.id,
      amount: 3,
      unit: 'g',
    })

    const items = await getShoppingListItems(user.id)

    expect(items).toHaveLength(1)
    expect(items[0].food.name).toBe('TestShopping Rice')
    expect(items[0].sourceType).toBe('food')
    expect(items[0].status).toBe('to_buy')
  })
})
