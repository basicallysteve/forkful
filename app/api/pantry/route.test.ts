import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { GET, POST } from './route'
import { getPantryItems, createPantryItem } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/pantry', () => ({
  getPantryItems: vi.fn(),
  createPantryItem: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

const mockItem = {
  id: 1,
  food: { id: 1, name: 'Chicken' },
  originalSize: { size: 16, unit: 'oz' },
  currentSize: { size: 8, unit: 'oz' },
  expirationDate: null,
  addedDate: new Date('2026-01-01'),
  status: 'good' as const,
  frozenDate: null,
}

function createPostRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/pantry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pantry', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
    expect(getPantryItems).not.toHaveBeenCalled()
  })

  it('returns items scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItems as Mock).mockResolvedValue([mockItem])

    const res = await GET()

    expect(res.status).toBe(200)
    expect(getPantryItems).toHaveBeenCalledWith(42)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(1)
  })
})

describe('POST /api/pantry', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await POST(createPostRequest({ foodId: 1, originalSizeAmount: 1, currentSizeAmount: 1 }))

    expect(res.status).toBe(401)
    expect(createPantryItem).not.toHaveBeenCalled()
  })

  it('creates an item scoped to the session user and returns 201', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (createPantryItem as Mock).mockResolvedValue(mockItem)

    const res = await POST(createPostRequest({
      foodId: 1,
      originalSizeAmount: 16,
      originalSizeUnit: 'oz',
      currentSizeAmount: 8,
      currentSizeUnit: 'oz',
      expirationDate: '2026-12-31',
    }))

    expect(res.status).toBe(201)
    expect(createPantryItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      foodId: 1,
      originalSizeAmount: 16,
      currentSizeAmount: 8,
      expirationDate: expect.any(Date),
    }))
  })

  it('passes null expirationDate when none is provided', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (createPantryItem as Mock).mockResolvedValue(mockItem)

    await POST(createPostRequest({
      foodId: 1,
      originalSizeAmount: 1,
      currentSizeAmount: 1,
    }))

    expect(createPantryItem).toHaveBeenCalledWith(expect.objectContaining({ expirationDate: null }))
  })

  it('ignores any client-supplied userId and uses the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (createPantryItem as Mock).mockResolvedValue(mockItem)

    await POST(createPostRequest({
      foodId: 1,
      originalSizeAmount: 1,
      currentSizeAmount: 1,
      userId: 999, // attempt to spoof
    }))

    // The session user (42) must win. Because of object spread order in the
    // handler, userId comes AFTER the spread, so 42 overwrites 999.
    expect(createPantryItem).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }))
  })
})
