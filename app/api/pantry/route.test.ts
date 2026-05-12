import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { GET, POST, DELETE } from './route'
import { getPantryItems, createPantryItem, deletePantryItems } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/pantry', () => ({
  getPantryItems: vi.fn(),
  createPantryItem: vi.fn(),
  deletePantryItems: vi.fn(),
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

function createDeleteRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/pantry', {
    method: 'DELETE',
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

describe('DELETE /api/pantry', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await DELETE(createDeleteRequest({ ids: [1, 2] }))

    expect(res.status).toBe(401)
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('returns 400 when ids array is missing', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(createDeleteRequest({}))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('ids array required')
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('returns 400 when ids is not an array', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(createDeleteRequest({ ids: 'not-an-array' }))

    expect(res.status).toBe(400)
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('returns 400 when ids array is empty', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(createDeleteRequest({ ids: [] }))

    expect(res.status).toBe(400)
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('deletes items scoped to the session user and returns deleted count', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    ;(deletePantryItems as Mock).mockResolvedValue(2)

    const res = await DELETE(createDeleteRequest({ ids: [1, 2] }))

    expect(res.status).toBe(200)
    expect(deletePantryItems).toHaveBeenCalledWith([1, 2], 42)
    const body = await res.json()
    expect(body.deletedCount).toBe(2)
  })
})
