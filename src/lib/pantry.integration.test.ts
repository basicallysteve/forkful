import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { getPantryItems, getPantryItemById, createPantryItem, updatePantryItem, deletePantryItem, deletePantryItems, getExpiringPantryItems } from './pantry'
import { createFood } from './foods'
import { signUp } from './users'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({ connectionString })

async function cleanup() {
  await pool.query(`DELETE FROM pantry_items WHERE food_id IN (SELECT id FROM foods WHERE name LIKE 'TestPantry%')`)
  await pool.query(`DELETE FROM foods WHERE name LIKE 'TestPantry%'`)
  await pool.query(`DELETE FROM users WHERE username LIKE 'testpantry%'`)
}

async function createTestUser(suffix: string) {
  return signUp({
    username: `testpantry${suffix}`,
    email: `testpantry${suffix}@test.com`,
    password: 'password123',
    cuisinePreferences: [],
    dietaryRestrictions: [],
  })
}

async function createTestFood() {
  return createFood({
    name: 'TestPantry Chicken',
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

describe('pantry data layer (integration)', () => {
  afterEach(cleanup)
  afterAll(() => pool.end())

  it('creates and retrieves a pantry item', async () => {
    const user = await createTestUser('a')
    const food = await createTestFood()

    const created = await createPantryItem({
      userId: user.id,
      foodId: food.id,
      originalSizeAmount: 2,
      originalSizeUnit: 'lb',
      currentSizeAmount: 1.5,
      currentSizeUnit: 'lb',
    })

    expect(created.id).toBeDefined()
    expect(created.food.name).toBe('TestPantry Chicken')
    expect(created.originalSize.size).toBe(2)
    expect(created.currentSize.size).toBe(1.5)
    expect(created.status).toBe('good')
    expect(created.frozenDate).toBeNull()
  })

  it('only returns items belonging to the requesting user', async () => {
    const userA = await createTestUser('b')
    const userB = await createTestUser('c')
    const food = await createTestFood()

    await createPantryItem({ userId: userA.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    await createPantryItem({ userId: userB.id, foodId: food.id, originalSizeAmount: 2, currentSizeAmount: 2 })

    const itemsA = await getPantryItems(userA.id)
    const itemsB = await getPantryItems(userB.id)

    expect(itemsA).toHaveLength(1)
    expect(itemsA[0].originalSize.size).toBe(1)
    expect(itemsB).toHaveLength(1)
    expect(itemsB[0].originalSize.size).toBe(2)
  })

  it('getPantryItemById returns null for a different user', async () => {
    const userA = await createTestUser('d')
    const userB = await createTestUser('e')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: userA.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })

    const fetchedByOwner = await getPantryItemById(item.id, userA.id)
    const fetchedByOther = await getPantryItemById(item.id, userB.id)

    expect(fetchedByOwner).not.toBeNull()
    expect(fetchedByOther).toBeNull()
  })

  it('calculates expiration status correctly', async () => {
    const user = await createTestUser('f')
    const food = await createTestFood()

    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)

    const soonDate = new Date()
    soonDate.setDate(soonDate.getDate() + 3)

    const goodDate = new Date()
    goodDate.setDate(goodDate.getDate() + 30)

    const [expired, expiringSoon, good] = await Promise.all([
      createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1, expirationDate: pastDate }),
      createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1, expirationDate: soonDate }),
      createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1, expirationDate: goodDate }),
    ])

    expect(expired.status).toBe('expired')
    expect(expiringSoon.status).toBe('expiring-soon')
    expect(good.status).toBe('good')
  })

  it('updates a pantry item', async () => {
    const user = await createTestUser('g')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 2, currentSizeAmount: 2 })
    const updated = await updatePantryItem({ id: item.id, userId: user.id, data: { currentSizeAmount: 1 } })

    expect(updated?.currentSize.size).toBe(1)
    expect(updated?.originalSize.size).toBe(2)
  })

  it('updatePantryItem returns null for a different user', async () => {
    const userA = await createTestUser('h')
    const userB = await createTestUser('i')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: userA.id, foodId: food.id, originalSizeAmount: 2, currentSizeAmount: 2 })
    const result = await updatePantryItem({ id: item.id, userId: userB.id, data: { currentSizeAmount: 0.5 } })

    expect(result).toBeNull()

    const unchanged = await getPantryItemById(item.id, userA.id)
    expect(unchanged?.currentSize.size).toBe(2)
  })

  it('can freeze and unfreeze an item', async () => {
    const user = await createTestUser('j')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    expect(item.frozenDate).toBeNull()

    const frozen = await updatePantryItem({ id: item.id, userId: user.id, data: { frozenDate: new Date() } })
    expect(frozen?.frozenDate).not.toBeNull()

    const thawed = await updatePantryItem({ id: item.id, userId: user.id, data: { frozenDate: null } })
    expect(thawed?.frozenDate).toBeNull()
  })

  it('soft-deletes a pantry item', async () => {
    const user = await createTestUser('k')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    const deleted = await deletePantryItem(item.id, user.id)
    expect(deleted).toBe(true)

    const fetched = await getPantryItemById(item.id, user.id)
    expect(fetched).toBeNull()
  })

  it('deletePantryItem returns false for a different user', async () => {
    const userA = await createTestUser('l')
    const userB = await createTestUser('m')
    const food = await createTestFood()

    const item = await createPantryItem({ userId: userA.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    const result = await deletePantryItem(item.id, userB.id)
    expect(result).toBe(false)

    const unchanged = await getPantryItemById(item.id, userA.id)
    expect(unchanged).not.toBeNull()
  })

  it('bulk deletes multiple pantry items', async () => {
    const user = await createTestUser('n')
    const food = await createTestFood()

    const item1 = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    const item2 = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 2, currentSizeAmount: 2 })
    const item3 = await createPantryItem({ userId: user.id, foodId: food.id, originalSizeAmount: 3, currentSizeAmount: 3 })

    const deletedIds = await deletePantryItems([item1.id, item2.id], user.id)
    expect(deletedIds).toEqual([item1.id, item2.id])

    const fetched1 = await getPantryItemById(item1.id, user.id)
    const fetched2 = await getPantryItemById(item2.id, user.id)
    const fetched3 = await getPantryItemById(item3.id, user.id)

    expect(fetched1).toBeNull()
    expect(fetched2).toBeNull()
    expect(fetched3).not.toBeNull()
  })

  it('bulk delete only deletes items owned by the user', async () => {
    const userA = await createTestUser('o')
    const userB = await createTestUser('p')
    const food = await createTestFood()

    const itemA = await createPantryItem({ userId: userA.id, foodId: food.id, originalSizeAmount: 1, currentSizeAmount: 1 })
    const itemB = await createPantryItem({ userId: userB.id, foodId: food.id, originalSizeAmount: 2, currentSizeAmount: 2 })

    const deletedIds = await deletePantryItems([itemA.id, itemB.id], userA.id)
    expect(deletedIds).toEqual([itemA.id])

    const fetchedA = await getPantryItemById(itemA.id, userA.id)
    const fetchedB = await getPantryItemById(itemB.id, userB.id)

    expect(fetchedA).toBeNull()
    expect(fetchedB).not.toBeNull()
  })

  it('bulk delete returns empty array for empty input', async () => {
    const user = await createTestUser('q')

    const deletedIds = await deletePantryItems([], user.id)
    expect(deletedIds).toEqual([])
  })

  describe('getExpiringPantryItems', () => {
    it('returns items expiring within the next 7 days, sorted soonest first', async () => {
      const user = await createTestUser(`exp_${Date.now()}`)
      const food = await createTestFood()

      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3)
      const in6Days = new Date(); in6Days.setDate(in6Days.getDate() + 6)
      const in10Days = new Date(); in10Days.setDate(in10Days.getDate() + 10)

      const [expired, soon3, soon6] = await Promise.all([
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: yesterday, originalSizeAmount: 1, currentSizeAmount: 1 }),
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: in3Days, originalSizeAmount: 1, currentSizeAmount: 1 }),
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: in6Days, originalSizeAmount: 1, currentSizeAmount: 1 }),
      ])
      // this one should be excluded (> 7 days out)
      await createPantryItem({ userId: user.id, foodId: food.id, expirationDate: in10Days, originalSizeAmount: 1, currentSizeAmount: 1 })

      const results = await getExpiringPantryItems(user.id)
      const ids = results.map(r => r.id)

      expect(ids).toContain(expired.id)
      expect(ids).toContain(soon3.id)
      expect(ids).toContain(soon6.id)
      expect(ids).not.toContain(in10Days) // sanity label — the item created with in10Days is excluded

      // sorted soonest first
      expect(ids.indexOf(expired.id)).toBeLessThan(ids.indexOf(soon3.id))
      expect(ids.indexOf(soon3.id)).toBeLessThan(ids.indexOf(soon6.id))
    })

    it('excludes items with no expiration date', async () => {
      const user = await createTestUser(`noexp_${Date.now()}`)
      const food = await createTestFood()

      const item = await createPantryItem({ userId: user.id, foodId: food.id, expirationDate: null, originalSizeAmount: 1, currentSizeAmount: 1 })

      const results = await getExpiringPantryItems(user.id)
      expect(results.some(r => r.id === item.id)).toBe(false)
    })

    it('respects the limit parameter', async () => {
      const user = await createTestUser(`lim_${Date.now()}`)
      const food = await createTestFood()

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      await Promise.all([
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: tomorrow, originalSizeAmount: 1, currentSizeAmount: 1 }),
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: tomorrow, originalSizeAmount: 1, currentSizeAmount: 1 }),
        createPantryItem({ userId: user.id, foodId: food.id, expirationDate: tomorrow, originalSizeAmount: 1, currentSizeAmount: 1 }),
      ])

      const results = await getExpiringPantryItems(user.id, 2)
      expect(results).toHaveLength(2)
    })

    it('does not return items belonging to a different user', async () => {
      const user1 = await createTestUser(`u1_${Date.now()}`)
      const user2 = await createTestUser(`u2_${Date.now()}`)
      const food = await createTestFood()

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      const item = await createPantryItem({ userId: user1.id, foodId: food.id, expirationDate: tomorrow, originalSizeAmount: 1, currentSizeAmount: 1 })

      const results = await getExpiringPantryItems(user2.id)
      expect(results.some(r => r.id === item.id)).toBe(false)
    })
  })
})
