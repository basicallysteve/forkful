import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { POST } from '../../app/api/log/route'
import { getSessionUser } from '@/lib/auth'
import { signUp } from './users'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
})

function postRequest(body: unknown) {
  return new Request('http://localhost/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/log (integration)', () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockReset()
  })

  afterEach(async () => {
    await pool.query(`DELETE FROM users WHERE username LIKE 'itestlogapi%'`)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('returns 404 and logs nothing when the foodId does not exist', async () => {
    const user = await signUp({
      username: 'itestlogapia',
      email: 'itestlogapia@test.com',
      password: 'password123',
      cuisinePreferences: [],
      dietaryRestrictions: [],
    })
    const userId = Number(user.id)
    vi.mocked(getSessionUser).mockResolvedValue({ userId, username: 'itestlogapia', avatarUrl: null, needsOnboarding: false, needsPasswordReset: false })

    const res = await POST(postRequest({ foodId: 2147483000, amount: 1, unit: 'g', logDate: '2026-11-16' }))

    expect(res.status).toBe(404)
    const { rows } = await pool.query('SELECT 1 FROM food_log_entries WHERE user_id = $1', [userId])
    expect(rows).toHaveLength(0)
  })
})
