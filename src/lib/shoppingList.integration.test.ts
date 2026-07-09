import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { createFood } from './foods'
import { createProduct } from './products'
import { signUp } from './users'
import {
  createShoppingListFoodItem,
  createShoppingListFreeformItem,
  createShoppingListProductItem,
  deleteShoppingListItem,
  getOrCreateActiveShoppingList,
  getShoppingListItems,
  splitShoppingListItem,
  updateShoppingListItemDetails,
  updateShoppingListItemStatus,
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

  it('rejects freeform name/unit that exceed the column limits before hitting the DB', async () => {
    const user = await createTestUser('j')

    await expect(
      createShoppingListFreeformItem({ userId: user.id, name: 'x'.repeat(256), amount: 1 })
    ).rejects.toThrow('Name is too long')

    await expect(
      createShoppingListFreeformItem({ userId: user.id, name: 'TestShopping Long Unit', amount: 1, unit: 'x'.repeat(51) })
    ).rejects.toThrow('Unit is too long')
  })

  it('rejects an amount above the numeric(10,2) ceiling, including via a merge', async () => {
    const user = await createTestUser('k')
    const food = await createTestFood('TestShopping Overflow')

    await expect(
      createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 100_000_000, unit: 'g' })
    ).rejects.toThrow('Amount is too large')

    // Two individually-valid adds whose sum overflows the column must fail cleanly, not 500.
    await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 99_999_999, unit: 'g' })
    await expect(
      createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 10, unit: 'g' })
    ).rejects.toThrow('Amount is too large')

    // The failed merge left the original line untouched.
    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(99_999_999)
  })

  it('merges a duplicate freeform name + unit line, case-insensitively', async () => {
    const user = await createTestUser('h')

    const first = await createShoppingListFreeformItem({ userId: user.id, name: 'TestShopping Foil', amount: 1, unit: 'roll' })
    // Different casing still merges; the existing line keeps its original casing.
    const second = await createShoppingListFreeformItem({ userId: user.id, name: 'testshopping foil', amount: 2, unit: 'roll' })

    expect(second.id).toBe(first.id)
    expect(second.amount).toBe(3)
    expect(second.name).toBe('TestShopping Foil')

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

  it('hard-deletes a line off the active list and reports success', async () => {
    const user = await createTestUser('j')
    const food = await createTestFood('TestShopping Deletable')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 1, unit: 'g' })

    const deleted = await deleteShoppingListItem(created.id, user.id)
    expect(deleted).toBe(true)

    // The row is gone outright — no soft-delete, so it no longer lists.
    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(0)

    const rows = await pool.query('SELECT id FROM shopping_list_items WHERE id = $1', [created.id])
    expect(rows.rowCount).toBe(0)
  })

  it('returns false and leaves the line intact when another user tries to delete it', async () => {
    const owner = await createTestUser('k')
    const intruder = await createTestUser('l')
    const food = await createTestFood('TestShopping Owned')

    const created = await createShoppingListFoodItem({ userId: owner.id, foodId: food.id, amount: 1, unit: 'g' })

    const deleted = await deleteShoppingListItem(created.id, intruder.id)
    expect(deleted).toBe(false)

    // The owner's line is untouched.
    const items = await getShoppingListItems(owner.id)
    expect(items).toHaveLength(1)
  })

  it('returns false for an unknown line id', async () => {
    const user = await createTestUser('m')

    const deleted = await deleteShoppingListItem(999_999_999, user.id)
    expect(deleted).toBe(false)
  })

  it('transitions a line through every status reversibly without touching its Food reference', async () => {
    const user = await createTestUser('n')
    const food = await createTestFood('TestShopping Transitions')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 1, unit: 'g' })
    expect(created.status).toBe('to_buy')

    // to_buy → bought → unavailable → to_buy, all reversible.
    for (const status of ['bought', 'unavailable', 'to_buy'] as const) {
      const updated = await updateShoppingListItemStatus(created.id, user.id, status)
      expect(updated).toEqual({ id: created.id, status })
    }

    // The foodId reference is never touched by a status change.
    const [row] = (await pool.query('SELECT status, food_id FROM shopping_list_items WHERE id = $1', [created.id])).rows
    expect(row.status).toBe('to_buy')
    expect(row.food_id).toBe(food.id)
  })

  it('returns null and leaves the status intact when another user tries to update it', async () => {
    const owner = await createTestUser('o')
    const intruder = await createTestUser('p')
    const food = await createTestFood('TestShopping Guarded')

    const created = await createShoppingListFoodItem({ userId: owner.id, foodId: food.id, amount: 1, unit: 'g' })

    const updated = await updateShoppingListItemStatus(created.id, intruder.id, 'bought')
    expect(updated).toBeNull()

    // The owner's line is unchanged.
    const items = await getShoppingListItems(owner.id)
    expect(items[0].status).toBe('to_buy')
  })

  it('records and clears a Line Price and expiration without touching the status or reference', async () => {
    const user = await createTestUser('q')
    const food = await createTestFood('TestShopping Priced')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 2, unit: 'g' })
    expect(created.linePrice).toBeNull()
    expect(created.expirationDate).toBeNull()

    const expiration = new Date('2026-02-01T00:00:00.000Z')
    const priced = await updateShoppingListItemDetails(created.id, user.id, { linePrice: 4.5, expirationDate: expiration })
    expect(priced?.linePrice).toBe(4.5)
    expect(priced?.expirationDate?.getTime()).toBe(expiration.getTime())
    // Only price/expiration change — the status and Food reference are left as they were.
    expect(priced?.status).toBe('to_buy')
    expect(priced?.food?.id).toBe(food.id)

    // Each field clears independently: null the price, leave the expiration untouched by omitting it.
    const cleared = await updateShoppingListItemDetails(created.id, user.id, { linePrice: null })
    expect(cleared?.linePrice).toBeNull()
    expect(cleared?.expirationDate?.getTime()).toBe(expiration.getTime())
  })

  it('rounds the persisted Line Price to the numeric(10,2) column and rejects a negative price', async () => {
    const user = await createTestUser('r')
    const food = await createTestFood('TestShopping Rounding')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 3, unit: 'g' })

    // A per-unit × quantity total computed upstream can arrive with float drift; it persists rounded.
    const priced = await updateShoppingListItemDetails(created.id, user.id, { linePrice: 0.1 + 0.2 })
    expect(priced?.linePrice).toBe(0.3)

    await expect(
      updateShoppingListItemDetails(created.id, user.id, { linePrice: -1 })
    ).rejects.toThrow('Price must be zero or greater')
  })

  it('returns null when another user tries to set a line’s price', async () => {
    const owner = await createTestUser('s')
    const intruder = await createTestUser('t')
    const food = await createTestFood('TestShopping PriceGuarded')

    const created = await createShoppingListFoodItem({ userId: owner.id, foodId: food.id, amount: 1, unit: 'g' })

    const updated = await updateShoppingListItemDetails(created.id, intruder.id, { linePrice: 9.99 })
    expect(updated).toBeNull()

    const items = await getShoppingListItems(owner.id)
    expect(items[0].linePrice).toBeNull()
  })

  it('splits a line into date-grouped lines, partitioning amount and distributing price', async () => {
    const user = await createTestUser('u')
    const food = await createTestFood('TestShopping Splittable')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 6, unit: 'g' })
    await updateShoppingListItemDetails(created.id, user.id, { linePrice: 6 })

    const augFirst = new Date('2026-08-01T00:00:00.000Z')
    const result = await splitShoppingListItem(created.id, user.id, [
      { amount: 4, expirationDate: augFirst },
      { amount: 2, expirationDate: null },
    ])

    expect(result).toHaveLength(2)

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(2)
    // The original line keeps its id as the first portion; a sibling line carries the rest.
    const original = items.find((item) => item.id === created.id)
    const sibling = items.find((item) => item.id !== created.id)
    expect(original?.amount).toBe(4)
    expect(original?.expirationDate?.getTime()).toBe(augFirst.getTime())
    expect(original?.food?.id).toBe(food.id)
    expect(sibling?.amount).toBe(2)
    expect(sibling?.expirationDate).toBeNull()
    expect(sibling?.food?.id).toBe(food.id)
    // The $6 total is split in proportion to amount (4:2), so the parts still sum to $6.
    expect((original?.linePrice ?? 0) + (sibling?.linePrice ?? 0)).toBe(6)
    expect(original?.linePrice).toBe(4)
    expect(sibling?.linePrice).toBe(2)
  })

  it('rejects a split whose portions do not sum to the line amount', async () => {
    const user = await createTestUser('v')
    const food = await createTestFood('TestShopping BadSplit')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 6, unit: 'g' })

    await expect(
      splitShoppingListItem(created.id, user.id, [
        { amount: 4, expirationDate: null },
        { amount: 1, expirationDate: null },
      ])
    ).rejects.toThrow('Portions must sum to the line amount')

    // The line is untouched.
    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(6)
  })

  it('rejects a split whose portion rounds to a zero amount', async () => {
    const user = await createTestUser('y')
    const food = await createTestFood('TestShopping SubCent')

    const created = await createShoppingListFoodItem({ userId: user.id, foodId: food.id, amount: 2, unit: 'g' })

    // A sub-cent share rounds to 0.00 at the column scale, so it is rejected rather than stored as a
    // zero-amount line.
    await expect(
      splitShoppingListItem(created.id, user.id, [
        { amount: 1.999, expirationDate: null },
        { amount: 0.001, expirationDate: null },
      ])
    ).rejects.toThrow('Amount must be greater than zero')

    const items = await getShoppingListItems(user.id)
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(2)
  })

  it('returns null when another user tries to split a line', async () => {
    const owner = await createTestUser('w')
    const intruder = await createTestUser('x')
    const food = await createTestFood('TestShopping SplitGuarded')

    const created = await createShoppingListFoodItem({ userId: owner.id, foodId: food.id, amount: 2, unit: 'g' })

    const result = await splitShoppingListItem(created.id, intruder.id, [
      { amount: 1, expirationDate: null },
      { amount: 1, expirationDate: null },
    ])
    expect(result).toBeNull()

    const items = await getShoppingListItems(owner.id)
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(2)
  })
})
