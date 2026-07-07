import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { createFood } from './foods'
import { createProduct } from './products'
import { signUp } from './users'
import {
  createShoppingListFoodItem,
  createShoppingListFreeformItem,
  createShoppingListProductItem,
  getOrCreateActiveShoppingList,
  getShoppingListItems,
} from './shoppingList'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({ connectionString })

async function cleanup() {
  await pool.query(`DELETE FROM shopping_list_items WHERE shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'testshopping%'))`)
  await pool.query(`DELETE FROM shopping_lists WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'testshopping%')`)
  await pool.query(`DELETE FROM products WHERE name LIKE 'TestShopping%'`)
  await pool.query(`DELETE FROM foods WHERE name LIKE 'TestShopping%'`)
  await pool.query(`DELETE FROM users WHERE username LIKE 'testshopping%'`)
}

async function createTestUser(suffix: string) {
  const user = await signUp({
    username: `testshopping${suffix}`,
    email: `testshopping${suffix}@test.com`,
    password: 'password123',
    cuisinePreferences: [],
    dietaryRestrictions: [],
  })
  // signUp returns User whose id is typed string | number | undefined; the
  // shopping-list helpers require a numeric userId. Coerce once here so every
  // call site downstream gets a plain number.
  return { ...user, id: Number(user.id) }
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

async function createTestProduct(name = 'TestShopping Cereal') {
  return createProduct({
    name,
    calories: 120,
    protein: 3,
    carbs: 25,
    fat: 1,
    fiber: 2,
    servingSize: 1,
    servingUnit: 'box',
    measurements: [{ unit: 'box' }],
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

    expect(created.food?.name).toBe('TestShopping Chicken')
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
    expect(items[0].food?.name).toBe('TestShopping Rice')
    expect(items[0].sourceType).toBe('food')
    expect(items[0].status).toBe('to_buy')
  })

  it('merges a duplicate food + unit line into the existing open line', async () => {
    const user = await createTestUser('d')
    const food = await createTestFood('TestShopping Merge')

    const first = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 2, unit: 'g' })
    const second = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 3, unit: 'g' })

    expect(second.id).toBe(first.id)
    expect(second.amount).toBe(5)

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(5)
  })

  it('keeps the same food as separate lines when the unit differs', async () => {
    const user = await createTestUser('e')
    const food = await createTestFood('TestShopping Units')

    await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 2, unit: 'g' })
    await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 3, unit: 'oz' })

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(2)
  })

  it('adds a product item with sourceType product, constrained to the product’s units', async () => {
    const user = await createTestUser('f')
    const product = await createTestProduct('TestShopping Cereal')

    const created = await createShoppingListProductItem({
      userId: user.id,
      productId: product.id,
      amount: 2,
      unit: 'box',
    })

    expect(created.sourceType).toBe('product')
    expect(created.status).toBe('to_buy')
    expect(created.name).toBe('TestShopping Cereal')
    expect(created.product?.id).toBe(product.id)
    expect(created.food).toBeUndefined()
    expect(created.amount).toBe(2)
    expect(created.unit).toBe('box')

    await expect(
      createShoppingListProductItem({ userId: user.id, productId: product.id, amount: 1, unit: 'gallon' })
    ).rejects.toThrow('Unit is not valid for this product')
  })

  it('adds a freeform item with sourceType freeform and an optional unit', async () => {
    const user = await createTestUser('g')

    const withUnit = await createShoppingListFreeformItem({
      userId: user.id,
      name: 'TestShopping Trash bags',
      amount: 2,
      unit: 'box',
    })

    expect(withUnit.sourceType).toBe('freeform')
    expect(withUnit.name).toBe('TestShopping Trash bags')
    expect(withUnit.food).toBeUndefined()
    expect(withUnit.product).toBeUndefined()
    expect(withUnit.unit).toBe('box')

    const withoutUnit = await createShoppingListFreeformItem({
      userId: user.id,
      name: 'TestShopping Napkins',
      amount: 1,
    })

    expect(withoutUnit.unit).toBeNull()

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.name).sort()).toEqual(['TestShopping Napkins', 'TestShopping Trash bags'])
  })

  it('merges a duplicate freeform name + unit line', async () => {
    const user = await createTestUser('h')

    const first = await createShoppingListFreeformItem({ userId: user.id, name: 'TestShopping Foil', amount: 1, unit: 'roll' })
    const second = await createShoppingListFreeformItem({ userId: user.id, name: 'TestShopping Foil', amount: 2, unit: 'roll' })

    expect(second.id).toBe(first.id)
    expect(second.amount).toBe(3)

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(1)
  })

  it('lists all three variants together on the active list', async () => {
    const user = await createTestUser('i')
    const food = await createTestFood('TestShopping Mixed Food')
    const product = await createTestProduct('TestShopping Mixed Product')

    await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 1, unit: 'g' })
    await createShoppingListProductItem({ userId: user.id, productId: product.id, amount: 1, unit: 'box' })
    await createShoppingListFreeformItem({ userId: user.id, name: 'TestShopping Mixed Freeform', amount: 1 })

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.sourceType).sort()).toEqual(['food', 'freeform', 'product'])
  })
})
