import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { POST } from '../../app/api/foods/route'
import { PUT, DELETE } from '../../app/api/foods/[slug]/route'
import { getSessionUser } from '@/lib/auth'
import { createFood, getFoodBySlug } from '@/lib/foods'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
})

const signedIn = { userId: 1, username: 'agent', avatarUrl: null, needsOnboarding: false, needsPasswordReset: false }

const newFood = {
  name: 'Test Route Apple',
  calories: 95,
  protein: 0.5,
  carbs: 25,
  fat: 0.3,
  fiber: 4,
  servingSize: 1,
  servingUnit: 'medium',
  measurements: [{ unit: 'medium' }, { unit: 'g' }],
}

function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/foods', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('food write routes require sign-in (integration)', () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockReset()
  })

  afterEach(async () => {
    await pool.query(`DELETE FROM "foods" WHERE name LIKE 'Test%'`)
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('POST /api/foods', () => {
    it('returns 401 and creates nothing without a session', async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null)
      const res = await POST(jsonRequest('POST', newFood))
      expect(res.status).toBe(401)
      expect(await getFoodBySlug('test-route-apple')).toBeNull()
    })

    it('creates the food with a session', async () => {
      vi.mocked(getSessionUser).mockResolvedValue(signedIn)
      const res = await POST(jsonRequest('POST', newFood))
      expect(res.status).toBe(201)
      expect((await res.json()).name).toBe('Test Route Apple')
      expect(await getFoodBySlug('test-route-apple')).not.toBeNull()
    })
  })

  describe('PUT /api/foods/[slug]', () => {
    it('returns 401 and changes nothing without a session', async () => {
      await createFood(newFood)
      vi.mocked(getSessionUser).mockResolvedValue(null)
      const res = await PUT(jsonRequest('PUT', { calories: 1 }), params('test-route-apple'))
      expect(res.status).toBe(401)
      expect((await getFoodBySlug('test-route-apple'))?.calories).toBe(95)
    })

    it('updates the food with a session', async () => {
      await createFood(newFood)
      vi.mocked(getSessionUser).mockResolvedValue(signedIn)
      const res = await PUT(jsonRequest('PUT', { calories: 100 }), params('test-route-apple'))
      expect(res.status).toBe(200)
      expect((await getFoodBySlug('test-route-apple'))?.calories).toBe(100)
    })
  })

  describe('DELETE /api/foods/[slug]', () => {
    it('returns 401 and deletes nothing without a session', async () => {
      await createFood(newFood)
      vi.mocked(getSessionUser).mockResolvedValue(null)
      const res = await DELETE(jsonRequest('DELETE'), params('test-route-apple'))
      expect(res.status).toBe(401)
      expect(await getFoodBySlug('test-route-apple')).not.toBeNull()
    })

    it('deletes the food with a session', async () => {
      await createFood(newFood)
      vi.mocked(getSessionUser).mockResolvedValue(signedIn)
      const res = await DELETE(jsonRequest('DELETE'), params('test-route-apple'))
      expect(res.status).toBe(204)
      expect(await getFoodBySlug('test-route-apple')).toBeNull()
    })
  })
})
