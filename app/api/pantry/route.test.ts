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

function createRequest(method: string, body: Record<string, unknown>) {
  return new Request('http://localhost/api/pantry', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createPostRequest(body: Record<string, unknown>) {
  return createRequest('POST', body)
}

function createDeleteRequest(body: Record<string, unknown>) {
  return createRequest('DELETE', body)
}

beforeEach(() => {
  vi.clearAllMocks()
})

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/pantry')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

describe('GET /api/pantry', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await GET(makeGetRequest())

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
    expect(getPantryItems).not.toHaveBeenCalled()
  })

  it('returns items scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItems as Mock).mockResolvedValue([mockItem])

    const res = await GET(makeGetRequest())

    expect(res.status).toBe(200)
    expect(getPantryItems).toHaveBeenCalledWith(42, {})
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(1)
  })

  it('passes search, status, sortBy, sortDir query params to getPantryItems', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItems as Mock).mockResolvedValue([])

    await GET(makeGetRequest({ search: 'chicken', status: 'expired', sortBy: 'name', sortDir: 'desc' }))

    expect(getPantryItems).toHaveBeenCalledWith(42, {
      search: 'chicken',
      status: 'expired',
      sortBy: 'name',
      sortDir: 'desc',
    })
  })

  it('ignores unknown query param values', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItems as Mock).mockResolvedValue([])

    await GET(makeGetRequest({ status: 'invalid', sortBy: 'bad', sortDir: 'sideways' }))

    expect(getPantryItems).toHaveBeenCalledWith(42, {})
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

  it('returns 400 when foodId is missing or invalid', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(createPostRequest({ foodId: 'bad', originalSizeAmount: 1, currentSizeAmount: 1 }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('foodId')
    expect(createPantryItem).not.toHaveBeenCalled()
  })

  it('returns 400 when originalSizeAmount is zero or negative', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(createPostRequest({ foodId: 1, originalSizeAmount: 0, currentSizeAmount: 1 }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('originalSizeAmount')
    expect(createPantryItem).not.toHaveBeenCalled()
  })

  it('returns 400 when currentSizeAmount is negative', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(createPostRequest({ foodId: 1, originalSizeAmount: 1, currentSizeAmount: -1 }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('currentSizeAmount')
    expect(createPantryItem).not.toHaveBeenCalled()
  })

  it('returns 400 when expirationDate is not a valid date string', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(createPostRequest({ foodId: 1, originalSizeAmount: 1, currentSizeAmount: 1, expirationDate: 'not-a-date' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('expirationDate')
    expect(createPantryItem).not.toHaveBeenCalled()
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

  it('returns 400 when ids contains non-integer values', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(createDeleteRequest({ ids: [1, 'two', 3] }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('must be integers')
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('returns 400 when ids contains floating point numbers', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(createDeleteRequest({ ids: [1, 2.5, 3] }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('must be integers')
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('returns 400 when ids array exceeds maximum length', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const tooManyIds = Array.from({ length: 501 }, (_, i) => i + 1)

    const res = await DELETE(createDeleteRequest({ ids: tooManyIds }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Cannot delete more than 500')
    expect(deletePantryItems).not.toHaveBeenCalled()
  })

  it('deletes items scoped to the session user and returns deleted IDs', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    ;(deletePantryItems as Mock).mockResolvedValue([1, 2])

    const res = await DELETE(createDeleteRequest({ ids: [1, 2] }))

    expect(res.status).toBe(200)
    expect(deletePantryItems).toHaveBeenCalledWith([1, 2], 42)
    const body = await res.json()
    expect(body.deletedIds).toEqual([1, 2])
  })

  it('allows deleting up to 500 items', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const maxIds = Array.from({ length: 500 }, (_, i) => i + 1)
    ;(deletePantryItems as Mock).mockResolvedValue(maxIds)

    const res = await DELETE(createDeleteRequest({ ids: maxIds }))

    expect(res.status).toBe(200)
    expect(deletePantryItems).toHaveBeenCalledWith(maxIds, 42)
  })
})
